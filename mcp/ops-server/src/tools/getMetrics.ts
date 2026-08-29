import { z } from "zod";
import type { MetricsFixture } from "../fixtures.js";
import { RECOVERY_DURATION_SECONDS, type ScenarioState } from "../scenarioState.js";

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

function valueAt(t: number, baseline: number, elevated: number, scenario: ScenarioState): number {
  if (!scenario.incident_triggered_at) return baseline;
  const incidentAt = new Date(scenario.incident_triggered_at).getTime();
  if (t < incidentAt) return baseline;

  if (!scenario.rollback_performed_at) return elevated;
  const rolledBackAt = new Date(scenario.rollback_performed_at).getTime();
  if (t < rolledBackAt) return elevated;

  const elapsedSeconds = (t - rolledBackAt) / 1000;
  if (elapsedSeconds >= RECOVERY_DURATION_SECONDS) return baseline;

  const progress = elapsedSeconds / RECOVERY_DURATION_SECONDS;
  return elevated - (elevated - baseline) * progress;
}

export function getMetricsHandler(
  input: GetMetricsInput,
  fixture: MetricsFixture,
  scenario: ScenarioState,
): GetMetricsOutput {
  const definition = fixture.metrics[input.metric];
  if (!definition) {
    throw new Error(`unknown metric "${input.metric}"`);
  }

  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  const stepMs = (input.step_seconds ?? fixture.step_seconds) * 1000;

  const points: MetricPoint[] = [];
  for (let t = start; t <= end; t += stepMs) {
    const value = valueAt(t, definition.baseline_value, definition.elevated_value, scenario);
    points.push({ t: new Date(t).toISOString(), value: Math.round(value * 100) / 100 });
  }
  return { unit: definition.unit, points };
}
