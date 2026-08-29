import { z } from "zod";
import type { LogsFixture } from "../fixtures.js";

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

// M1 scope: baseline traffic only, evenly spread across the window. The
// incident error signature (fixture.incident_error_template) is wired in at
// M4 once scenarioState exists to say whether an incident is currently armed.
export function getLogsHandler(input: GetLogsInput, fixture: LogsFixture): GetLogsOutput {
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  const stepMs = 60_000 / fixture.baseline_entries_per_minute;

  const entries: LogEntry[] = [];
  let templateIndex = 0;
  for (let t = start; t <= end; t += stepMs) {
    const template = fixture.baseline_templates[templateIndex % fixture.baseline_templates.length];
    entries.push({
      timestamp: new Date(t).toISOString(),
      level: template.level,
      message: template.message,
      service: input.service,
    });
    templateIndex++;
  }
  return { entries };
}
