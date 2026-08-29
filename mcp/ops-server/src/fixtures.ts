import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface LogTemplate {
  level: string;
  message: string;
}

export interface LogsFixture {
  service: string;
  baseline_templates: LogTemplate[];
  incident_error_template: LogTemplate;
  baseline_entries_per_minute: number;
  incident_entries_per_minute: number;
}

export interface MetricDefinition {
  unit: string;
  baseline_value: number;
  elevated_value: number;
}

export interface MetricsFixture {
  service: string;
  metrics: Record<string, MetricDefinition>;
  step_seconds: number;
}

export interface DeployFixtureEntry {
  commit_sha: string;
  minutes_before_incident: number;
  deployed_by: string;
  note?: string;
}

export interface DeploysFixture {
  service: string;
  environment: string;
  deploys: DeployFixtureEntry[];
}

export interface ProjectFixtures {
  logs: LogsFixture;
  metrics: MetricsFixture;
  deploys: DeploysFixture;
}

// This package's own location on disk — used to compute the default demo
// project path so fixtures resolve correctly regardless of the process's
// current working directory (e.g. `npm run dev -w mcp/ops-server` runs with
// cwd set to this package, not the repo root).
const PACKAGE_DIR = resolve(import.meta.dirname, "..");
const REPO_ROOT = resolve(PACKAGE_DIR, "../..");

function resolveProjectDir(): string {
  const explicit = process.env.OPS_MCP_PROJECT_DIR;
  if (explicit) return resolve(REPO_ROOT, explicit);

  const projectName = process.env.DEFAULT_PROJECT ?? "sample-checkout";
  return join(REPO_ROOT, "demo", projectName);
}

let cached: ProjectFixtures | undefined;

export function loadFixtures(): ProjectFixtures {
  if (cached) return cached;

  const projectDir = resolveProjectDir();
  const readJson = <T>(file: string): T =>
    JSON.parse(readFileSync(join(projectDir, "seed", file), "utf8")) as T;

  cached = {
    logs: readJson<LogsFixture>("logs.json"),
    metrics: readJson<MetricsFixture>("metrics.json"),
    deploys: readJson<DeploysFixture>("deploys.json"),
  };
  return cached;
}
