import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { armIncident, getScenarioState, recordRollback, resetScenario } from "../mcp/ops-server/src/scenarioState.js";
import { getBisectKitHandler } from "../mcp/ops-server/src/tools/getBisectKit.js";
import { getLogsHandler } from "../mcp/ops-server/src/tools/getLogs.js";
import { getMetricsHandler } from "../mcp/ops-server/src/tools/getMetrics.js";
import { listDeploysHandler } from "../mcp/ops-server/src/tools/listDeploys.js";
import { rollbackDeployHandler, rollbackDeployInputShape } from "../mcp/ops-server/src/tools/rollbackDeploy.js";
import { restartServiceInputShape } from "../mcp/ops-server/src/tools/restartService.js";

const PROJECT = "sample-checkout";
const SERVICE = "checkout-api";
const SEED_DIR = join(import.meta.dirname, "../demo/sample-checkout/seed");

function readSeed<T>(file: string): T {
  return JSON.parse(readFileSync(join(SEED_DIR, file), "utf8")) as T;
}

const metricsFixture = readSeed<import("../mcp/ops-server/src/fixtures.js").MetricsFixture>("metrics.json");
const logsFixture = readSeed<import("../mcp/ops-server/src/fixtures.js").LogsFixture>("logs.json");
const deploysFixture = readSeed<import("../mcp/ops-server/src/fixtures.js").DeploysFixture>("deploys.json");

describe("ops-mcp tool handlers", () => {
  beforeEach(() => {
    resetScenario(PROJECT, SERVICE);
  });

  describe("get_metrics", () => {
    it("returns a flat baseline series when no incident is armed", () => {
      const scenario = getScenarioState(PROJECT, SERVICE);
      const result = getMetricsHandler(
        { project: PROJECT, service: SERVICE, metric: "error_rate_pct", start: "2026-01-01T00:00:00Z", end: "2026-01-01T00:10:00Z" },
        metricsFixture,
        scenario,
      );
      expect(result.points.every((p) => p.value === 0.3)).toBe(true);
    });

    it("shows baseline before the incident and elevated after", () => {
      const incidentAt = "2026-01-01T00:05:00Z";
      armIncident(PROJECT, SERVICE, incidentAt);
      const scenario = getScenarioState(PROJECT, SERVICE);

      const result = getMetricsHandler(
        { project: PROJECT, service: SERVICE, metric: "error_rate_pct", start: "2026-01-01T00:00:00Z", end: "2026-01-01T00:10:00Z", step_seconds: 60 },
        metricsFixture,
        scenario,
      );

      const incidentAtMs = new Date(incidentAt).getTime();
      const before = result.points.filter((p) => new Date(p.t).getTime() < incidentAtMs);
      const after = result.points.filter((p) => new Date(p.t).getTime() >= incidentAtMs);
      expect(before.every((p) => p.value === 0.3)).toBe(true);
      expect(after.every((p) => p.value === 6.0)).toBe(true);
    });

    it("shows a recovery curve back to baseline after a rollback", () => {
      const incidentAt = new Date("2026-01-01T00:00:00Z");
      const rolledBackAt = new Date(incidentAt.getTime() + 5 * 60_000);
      armIncident(PROJECT, SERVICE, incidentAt.toISOString());
      recordRollback(PROJECT, SERVICE, rolledBackAt.toISOString(), "9f01");
      const scenario = getScenarioState(PROJECT, SERVICE);

      const rightAfterRollback = getMetricsHandler(
        { project: PROJECT, service: SERVICE, metric: "error_rate_pct", start: rolledBackAt.toISOString(), end: rolledBackAt.toISOString() },
        metricsFixture,
        scenario,
      );
      expect(rightAfterRollback.points[0].value).toBe(6.0);

      const wellAfterRollback = new Date(rolledBackAt.getTime() + 60_000).toISOString(); // +60s > 30s recovery window
      const settled = getMetricsHandler(
        { project: PROJECT, service: SERVICE, metric: "error_rate_pct", start: wellAfterRollback, end: wellAfterRollback },
        metricsFixture,
        scenario,
      );
      expect(settled.points[0].value).toBe(0.3);
    });
  });

  describe("get_logs", () => {
    it("emits the incident error signature only during the incident window", () => {
      const incidentAt = "2026-01-01T00:05:00Z";
      armIncident(PROJECT, SERVICE, incidentAt);
      const scenario = getScenarioState(PROJECT, SERVICE);

      const result = getLogsHandler(
        { project: PROJECT, service: SERVICE, start: "2026-01-01T00:00:00Z", end: "2026-01-01T00:06:00Z" },
        logsFixture,
        scenario,
      );

      const incidentAtMs = new Date(incidentAt).getTime();
      const beforeEntries = result.entries.filter((e) => new Date(e.timestamp).getTime() < incidentAtMs);
      const duringEntries = result.entries.filter((e) => new Date(e.timestamp).getTime() >= incidentAtMs);
      expect(beforeEntries.length).toBeGreaterThan(0);
      expect(duringEntries.length).toBeGreaterThan(0);
      expect(beforeEntries.every((e) => e.message !== logsFixture.incident_error_template.message)).toBe(true);
      expect(duringEntries.every((e) => e.message === logsFixture.incident_error_template.message)).toBe(true);
    });
  });

  describe("list_deploys", () => {
    it("appends a rollback deploy entry once a rollback is recorded", () => {
      const incidentAt = new Date("2026-01-01T01:00:00Z");
      armIncident(PROJECT, SERVICE, incidentAt.toISOString());
      const rolledBackAt = new Date(incidentAt.getTime() + 60_000).toISOString();
      recordRollback(PROJECT, SERVICE, rolledBackAt, "9f01");
      const scenario = getScenarioState(PROJECT, SERVICE);

      const result = listDeploysHandler(
        { project: PROJECT, service: SERVICE, start: "2026-01-01T00:00:00Z", end: "2026-01-01T02:00:00Z" },
        deploysFixture,
        scenario,
      );

      const rollbackEntry = result.deploys.find((d) => d.deployed_at === rolledBackAt);
      expect(rollbackEntry).toBeDefined();
      expect(rollbackEntry?.commit_sha).toBe("9f01");
      expect(rollbackEntry?.deployed_by).toBe("warden");
    });
  });

  describe("rollback_deploy", () => {
    it("mutates scenarioState so a subsequent get_metrics call shows recovery", () => {
      armIncident(PROJECT, SERVICE, new Date().toISOString());

      const rollbackResult = rollbackDeployHandler({
        project: PROJECT,
        service: SERVICE,
        target_commit_sha: "9f01",
        environment: "production",
      });
      expect(rollbackResult.status).toBe("ok");
      expect(rollbackResult.active_commit_sha).toBe("9f01");

      const scenario = getScenarioState(PROJECT, SERVICE);
      expect(scenario.rollback_performed_at).toBe(rollbackResult.rolled_back_at);
      expect(scenario.rolled_back_to_commit_sha).toBe("9f01");
    });

    it("rejects an empty target_commit_sha at the schema level", () => {
      const result = z.object(rollbackDeployInputShape).safeParse({
        project: PROJECT,
        service: SERVICE,
        target_commit_sha: "",
        environment: "production",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty project or service", () => {
      const missingProject = z.object(rollbackDeployInputShape).safeParse({
        project: "",
        service: SERVICE,
        target_commit_sha: "9f01",
        environment: "production",
      });
      expect(missingProject.success).toBe(false);
    });
  });

  describe("restart_service", () => {
    it("rejects an empty project, service, or environment", () => {
      const result = z.object(restartServiceInputShape).safeParse({
        project: PROJECT,
        service: "",
        environment: "production",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("get_bisect_kit", () => {
    it("returns exactly the requested commit shas' files", () => {
      const result = getBisectKitHandler({ project: PROJECT, commit_shas: ["7e484d6", "bb83296"] });
      expect(result.candidates.map((c) => c.commit_sha)).toEqual(["7e484d6", "bb83296"]);
      expect(result.candidates[0].files[0].path).toBe("candidates/7e484d6/service.py");
      expect(result.harness.path).toBe("harness.py");
    });
  });
});
