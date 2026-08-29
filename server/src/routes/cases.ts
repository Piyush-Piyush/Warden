import type Database from "better-sqlite3";
import { Router } from "express";
import { getCase, getLatestPendingApprovalForCase, listCaseEvents, listCases } from "../caseStore/queries.js";

export function createCasesRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/api/cases", (_req, res) => {
    res.json({ data: listCases(db) });
  });

  router.get("/api/cases/:id", (req, res) => {
    const theCase = getCase(db, req.params.id);
    if (!theCase) {
      res.status(404).json({ error: "case not found" });
      return;
    }
    const events = listCaseEvents(db, theCase.id);
    const pendingApproval = getLatestPendingApprovalForCase(db, theCase.id);
    res.json({ data: { ...theCase, events, pending_approval: pendingApproval ?? null } });
  });

  return router;
}
