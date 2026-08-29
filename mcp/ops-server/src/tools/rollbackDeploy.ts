import { z } from "zod";
import { recordRollback } from "../scenarioState.js";

export const rollbackDeployInputShape = {
  project: z.string(),
  service: z.string(),
  target_commit_sha: z.string(),
  environment: z.string(),
};

const rollbackDeployInput = z.object(rollbackDeployInputShape);
export type RollbackDeployInput = z.infer<typeof rollbackDeployInput>;

export interface RollbackDeployOutput {
  status: "ok";
  active_commit_sha: string;
  rolled_back_at: string;
}

// Destructive, approval-gated (see mcp/ops-server/src/index.ts's
// destructiveHint annotation, and agents/incident-responder.agent.json's
// require_approval_for_tools, derived from incident.yaml). This is the one
// tool call in the whole flow that changes what's actually "running": it
// records the rollback in scenarioState, which is what drives get_metrics'
// and get_logs' recovery curve on the next read.
export function rollbackDeployHandler(input: RollbackDeployInput): RollbackDeployOutput {
  const rolledBackAt = new Date().toISOString();
  recordRollback(input.project, input.service, rolledBackAt, input.target_commit_sha);
  return {
    status: "ok",
    active_commit_sha: input.target_commit_sha,
    rolled_back_at: rolledBackAt,
  };
}
