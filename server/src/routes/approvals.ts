import type Database from "better-sqlite3";
import { Router } from "express";
import { z } from "zod";
import { getCase, getLatestPendingApprovalForCase } from "../caseStore/queries.js";
import type { SessionRunner } from "../trueforge/sessionRunner.js";

const DecisionBodySchema = z.object({
  decided_by: z.string().min(1),
  reason: z.string().optional(),
});

export function createApprovalsRouter(db: Database.Database, runner: SessionRunner): Router {
  const router = Router();

  async function handleDecision(caseId: string, allow: boolean, req: import("express").Request, res: import("express").Response) {
    const theCase = getCase(db, caseId);
    if (!theCase) {
      res.status(404).json({ error: "case not found" });
      return;
    }
    const approval = getLatestPendingApprovalForCase(db, caseId);
    if (!approval) {
      res.status(409).json({ error: "no pending approval on this case" });
      return;
    }

    const parsed = DecisionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const decision = allow
      ? ({ status: "allow" } as const)
      : ({ status: "deny", reason: parsed.data.reason } as const);

    const result = await runner.resumeApproval(caseId, theCase.trueforge_session_id, approval.id, decision, parsed.data.decided_by);
    res.json({ data: result });
  }

  router.post("/api/cases/:id/approve", (req, res) => {
    handleDecision(req.params.id, true, req, res).catch((err) => {
      console.error("approve failed:", err);
      res.status(500).json({ error: "internal error" });
    });
  });

  router.post("/api/cases/:id/deny", (req, res) => {
    handleDecision(req.params.id, false, req, res).catch((err) => {
      console.error("deny failed:", err);
      res.status(500).json({ error: "internal error" });
    });
  });

  return router;
}
