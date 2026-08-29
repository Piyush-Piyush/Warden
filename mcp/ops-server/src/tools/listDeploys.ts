import { z } from "zod";
import type { DeploysFixture } from "../fixtures.js";

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

// M1 scope: deploy times are anchored to "now" (Date.now()), since no
// scenarioState.incident_triggered_at exists yet to anchor to instead — M4
// switches the anchor once an incident is armed via /admin/reset.
export function listDeploysHandler(
  input: ListDeploysInput,
  fixture: DeploysFixture,
  anchor: number = Date.now(),
): ListDeploysOutput {
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();

  const deploys = fixture.deploys
    .map((d) => ({
      id: d.commit_sha,
      service: fixture.service,
      environment: fixture.environment,
      commit_sha: d.commit_sha,
      deployed_at: new Date(anchor - d.minutes_before_incident * 60_000).toISOString(),
      deployed_by: d.deployed_by,
    }))
    .filter((d) => {
      const t = new Date(d.deployed_at).getTime();
      return t >= start && t <= end;
    })
    .sort((a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime());

  return { deploys };
}
