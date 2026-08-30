import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { Router } from "express";
import { z } from "zod";
import { createCase } from "../caseStore/queries.js";
import { loadProjectManifest } from "../config/manifest.js";
import type { TrueForgeClient } from "../trueforge/client.js";
import type { SessionRunner } from "../trueforge/sessionRunner.js";

export const AlertSchema = z.object({
  project: z.string(),
  service: z.string(),
  alert_name: z.string().optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
  metric: z.string(),
  observed_value: z.number(),
  threshold: z.number(),
  triggered_at: z.string(),
});

const OPS_MCP_ADMIN_URL = process.env.OPS_MCP_ADMIN_URL ?? "http://localhost:4000";
const AGENT_NAME = process.env.AGENT_NAME ?? "incident-responder";

export function createWebhookRouter(db: Database.Database, client: TrueForgeClient, runner: SessionRunner): Router {
  const router = Router();

  router.post("/webhooks/alert", async (req, res) => {
    const parsed = AlertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const alert = parsed.data;

    let manifestResult: ReturnType<typeof loadProjectManifest>;
    try {
      manifestResult = loadProjectManifest(alert.project);
    } catch (err) {
      res.status(404).json({ error: `unknown project "${alert.project}": ${(err as Error).message}` });
      return;
    }
    const { rawYaml } = manifestResult;

    // Arm the incident scenario in ops-mcp so get_logs/get_metrics/list_deploys
    // reflect this alert. Server-to-server call, never something the agent
    // itself can trigger.
    await fetch(`${OPS_MCP_ADMIN_URL}/admin/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: alert.project,
        service: alert.service,
        incident_triggered_at: alert.triggered_at,
      }),
    }).catch((err) => console.error("failed to arm ops-mcp scenario:", err));

    const caseId = randomUUID();
    const sessionId = await client.createSession(AGENT_NAME);

    createCase(db, {
      id: caseId,
      project: alert.project,
      service: alert.service,
      alert_name: alert.alert_name ?? null,
      severity: alert.severity ?? null,
      trueforge_session_id: sessionId,
    });

    res.status(202).json({ case_id: caseId, session_id: sessionId, status: "accepted" });

    // Fire and forget: the HTTP response above doesn't wait for the
    // investigation. SessionRunner drives case-store updates as the agent's
    // turn stream progresses.
    const message = `A production alert just fired:\n\n${JSON.stringify(alert, null, 2)}\n\nHere is the project manifest for this service:\n\n${rawYaml}\n\nInvestigate.`;
    runner.startInvestigation(caseId, sessionId, message).catch((err) => {
      console.error(`investigation failed for case ${caseId}:`, err);
    });
  });

  return router;
}
