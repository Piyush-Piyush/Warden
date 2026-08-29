import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseManifestYaml, type Manifest } from "@warden/shared";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const cache = new Map<string, { manifest: Manifest; rawYaml: string }>();

function resolveProjectDir(project: string): string {
  const explicit = process.env.PROJECTS_DIR;
  if (explicit) return resolve(REPO_ROOT, explicit, project);
  return join(REPO_ROOT, "demo", project);
}

export function loadProjectManifest(project: string): { manifest: Manifest; rawYaml: string } {
  const cached = cache.get(project);
  if (cached) return cached;

  const rawYaml = readFileSync(join(resolveProjectDir(project), "incident.yaml"), "utf8");
  const manifest = parseManifestYaml(rawYaml);
  const entry = { manifest, rawYaml };
  cache.set(project, entry);
  return entry;
}
