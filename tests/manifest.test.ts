import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ManifestV1, parseManifestYaml } from "../shared/src/manifest.js";

const SAMPLE_MANIFEST_PATH = join(import.meta.dirname, "../demo/sample-checkout/incident.yaml");

describe("ManifestV1", () => {
  it("parses the real sample-checkout incident.yaml", () => {
    const yamlText = readFileSync(SAMPLE_MANIFEST_PATH, "utf8");
    const manifest = parseManifestYaml(yamlText);

    expect(manifest.project).toBe("sample-checkout");
    expect(manifest.services[0].name).toBe("checkout-api");
    expect(manifest.actions.approval_required).toContain("rollback_deploy");
    expect(manifest.actions.approval_required).toContain("restart_service");
  });

  it("rejects a manifest missing a required field", () => {
    const broken = {
      version: 1,
      // project missing
      services: [{ name: "x", owner: "y", slo: { error_rate_pct: 1, p99_latency_ms: 100 } }],
      signals: {
        metrics: { mcp_server: "ops-server", tool: "get_metrics", default_metric: "error_rate_pct" },
        logs: { mcp_server: "ops-server", tool: "get_logs", query_hint: "" },
        deploys: { mcp_server: "ops-server", repo: "x/y", environment: "production" },
      },
      bisect: { enabled: true, kit_tool: "get_bisect_kit", candidate_window_minutes: 30 },
      actions: { safe: [], approval_required: [] },
      rollback: { strategy: "revert_deploy", mcp_server: "ops-server", tool: "rollback_deploy", runbook: "x" },
      verification: { metric: "error_rate_pct", target_below: 1, window_minutes: 5, poll_interval_seconds: 15 },
      escalation: { notify: "#x", human_approver_role: "on-call-lead" },
    };
    expect(() => ManifestV1.parse(broken)).toThrow();
  });

  it("rejects an unknown value in actions.approval_required's sibling actions.safe type", () => {
    const broken = { version: 1, project: "x", services: [] };
    expect(() => ManifestV1.parse(broken)).toThrow(/services/);
  });
});
