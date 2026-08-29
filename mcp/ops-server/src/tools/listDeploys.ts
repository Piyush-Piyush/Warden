import { z } from "zod";
import type { DeploysFixture } from "../fixtures.js";
import type { ScenarioState } from "../scenarioState.js";

export const listDeploysInputShape = {
  project: z.string(),
  service: z.string(),
  start: z.string().describe("ISO 8601 window start"),
  end: z.string().describe("ISO 8601 window end"),
};

const listDeploysInput = z.object(listDeploysInputShape);
export type ListDeploysInput = z.infer<typeof listDeploysInput>;

export interface DeployEntry {
  id: string;
  service: string;
  environment: string;
  commit_sha: string;
  deployed_at: string;
  deployed_by: string;
}

export interface ListDeploysOutput {
  deploys: DeployEntry[];
}

export function listDeploysHandler(
  input: ListDeploysInput,
  fixture: DeploysFixture,
  scenario: ScenarioState,
): ListDeploysOutput {
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  // Anchor to the armed incident time once one exists, so the deploy
  // timeline stays consistent with what get_logs/get_metrics are reporting;
  // falls back to "now" when no incident is armed (matches M1 behavior).
  const anchor = scenario.incident_triggered_at ? new Date(scenario.incident_triggered_at).getTime() : Date.now();

  const deploys = fixture.deploys.map((d) => ({
    id: d.commit_sha,
    service: fixture.service,
    environment: fixture.environment,
    commit_sha: d.commit_sha,
    deployed_at: new Date(anchor - d.minutes_before_incident * 60_000).toISOString(),
    deployed_by: d.deployed_by,
  }));

  // A rollback is itself a deploy — reflect it in the timeline once it's
  // happened, so the case timeline/dashboard shows the full picture.
  if (scenario.rollback_performed_at && scenario.rolled_back_to_commit_sha) {
    deploys.push({
      id: `rollback-${scenario.rolled_back_to_commit_sha}`,
      service: fixture.service,
      environment: fixture.environment,
      commit_sha: scenario.rolled_back_to_commit_sha,
      deployed_at: scenario.rollback_performed_at,
      deployed_by: "warden",
    });
  }

  const filtered = deploys
    .filter((d) => {
      const t = new Date(d.deployed_at).getTime();
      return t >= start && t <= end;
    })
    .sort((a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime());

  return { deploys: filtered };
}
