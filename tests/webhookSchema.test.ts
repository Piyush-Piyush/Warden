import { describe, expect, it } from "vitest";
import { AlertSchema } from "../server/src/routes/webhook.js";

const baseAlert = {
  project: "sample-checkout",
  service: "checkout-api",
  metric: "error_rate_pct",
  observed_value: 6.0,
  threshold: 1.0,
  triggered_at: "2026-01-01T00:00:00.000Z",
};

describe("AlertSchema", () => {
  it("accepts a well-formed alert with a known severity", () => {
    const result = AlertSchema.safeParse({ ...baseAlert, severity: "critical" });
    expect(result.success).toBe(true);
  });

  it("accepts an alert with no severity at all", () => {
    const result = AlertSchema.safeParse(baseAlert);
    expect(result.success).toBe(true);
  });

  it("rejects a severity value outside the known set", () => {
    const result = AlertSchema.safeParse({ ...baseAlert, severity: "banana" });
    expect(result.success).toBe(false);
  });

  it("rejects an alert missing a required field", () => {
    const { metric: _metric, ...withoutMetric } = baseAlert;
    const result = AlertSchema.safeParse(withoutMetric);
    expect(result.success).toBe(false);
  });
});
