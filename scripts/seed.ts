// Sanity-checks the demo project's fixtures and manifest before anything
// else depends on them: confirms the files exist, parse, and are internally
// consistent (e.g. every metric referenced by incident.yaml actually has a
// fixture definition).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifestYaml } from "../shared/src/manifest.js";
import type { DeploysFixture, LogsFixture, MetricsFixture } from "../mcp/ops-server/src/fixtures.js";

const PROJECT = process.env.DEFAULT_PROJECT ?? "sample-checkout";
const PROJECT_DIR = join(import.meta.dirname, "..", "demo", PROJECT);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(PROJECT_DIR, "seed", file), "utf8")) as T;
}

function main() {
  console.log(`Checking demo project: ${PROJECT_DIR}`);

  const manifestText = readFileSync(join(PROJECT_DIR, "incident.yaml"), "utf8");
  const manifest = parseManifestYaml(manifestText);
  console.log(`  incident.yaml OK: project "${manifest.project}", ${manifest.services.length} service(s)`);

  const logs = readJson<LogsFixture>("logs.json");
  const metrics = readJson<MetricsFixture>("metrics.json");
  const deploys = readJson<DeploysFixture>("deploys.json");
  console.log(`  logs.json OK: ${logs.baseline_templates.length} baseline template(s)`);
  console.log(`  metrics.json OK, metrics: ${Object.keys(metrics.metrics).join(", ")}`);
  console.log(`  deploys.json OK: ${deploys.deploys.length} deploy(s)`);

  const defaultMetric = manifest.signals.metrics.default_metric;
  if (!(defaultMetric in metrics.metrics)) {
    throw new Error(
      `incident.yaml's signals.metrics.default_metric ("${defaultMetric}") has no matching entry in metrics.json`,
    );
  }
  const verificationMetric = manifest.verification.metric;
  if (!(verificationMetric in metrics.metrics)) {
    throw new Error(
      `incident.yaml's verification.metric ("${verificationMetric}") has no matching entry in metrics.json`,
    );
  }

  console.log("All fixtures consistent with the manifest. Seed check passed.");
}

main();
