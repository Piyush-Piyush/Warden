import { z } from "zod";
import type { LogsFixture } from "../fixtures.js";
import { RECOVERY_DURATION_SECONDS, type ScenarioState } from "../scenarioState.js";

export const getLogsInputShape = {
  project: z.string(),
  service: z.string(),
  start: z.string().describe("ISO 8601 window start"),
  end: z.string().describe("ISO 8601 window end"),
  query_hint: z.string().optional(),
};

const getLogsInput = z.object(getLogsInputShape);
export type GetLogsInput = z.infer<typeof getLogsInput>;

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
}

export interface GetLogsOutput {
  entries: LogEntry[];
}

function isDuringIncident(t: number, scenario: ScenarioState): boolean {
  if (!scenario.incident_triggered_at) return false;
  const incidentAt = new Date(scenario.incident_triggered_at).getTime();
  if (t < incidentAt) return false;
  if (!scenario.rollback_performed_at) return true;
  const recoveryCompleteAt =
    new Date(scenario.rollback_performed_at).getTime() + RECOVERY_DURATION_SECONDS * 1000;
  return t < recoveryCompleteAt;
}

export function getLogsHandler(
  input: GetLogsInput,
  fixture: LogsFixture,
  scenario: ScenarioState,
): GetLogsOutput {
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();

  const entries: LogEntry[] = [];
  let templateIndex = 0;
  let t = start;
  while (t <= end) {
    const duringIncident = isDuringIncident(t, scenario);
    if (duringIncident) {
      entries.push({
        timestamp: new Date(t).toISOString(),
        level: fixture.incident_error_template.level,
        message: fixture.incident_error_template.message,
        service: input.service,
      });
      t += 60_000 / fixture.incident_entries_per_minute;
    } else {
      const template = fixture.baseline_templates[templateIndex % fixture.baseline_templates.length];
      entries.push({
        timestamp: new Date(t).toISOString(),
        level: template.level,
        message: template.message,
        service: input.service,
      });
      templateIndex++;
      t += 60_000 / fixture.baseline_entries_per_minute;
    }
  }
  return { entries };
}
