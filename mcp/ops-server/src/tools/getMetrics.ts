import { z } from "zod";
import type { MetricsFixture } from "../fixtures.js";

export const getMetricsInputShape = {
  project: z.string(),
  service: z.string(),
  metric: z.string(),
  start: z.string().describe("ISO 8601 window start"),
  end: z.string().describe("ISO 8601 window end"),
  step_seconds: z.number().positive().optional(),
};

const getMetricsInput = z.object(getMetricsInputShape);
export type GetMetricsInput = z.infer<typeof getMetricsInput>;

export interface MetricPoint {
  t: string;
  value: number;
}

export interface GetMetricsOutput {
  unit: string;
  points: MetricPoint[];
}

// M1 scope: flat baseline series. The elevated/decay-curve behavior driven by
// scenarioState.incident_triggered_at is wired in at M4.
export function getMetricsHandler(input: GetMetricsInput, fixture: MetricsFixture): GetMetricsOutput {
  const definition = fixture.metrics[input.metric];
  if (!definition) {
    throw new Error(`unknown metric "${input.metric}"`);
  }

  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  const stepMs = (input.step_seconds ?? fixture.step_seconds) * 1000;

  const points: MetricPoint[] = [];
  for (let t = start; t <= end; t += stepMs) {
    points.push({ t: new Date(t).toISOString(), value: definition.baseline_value });
  }
  return { unit: definition.unit, points };
}
