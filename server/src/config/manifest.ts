import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseManifestYaml, type Manifest } from "@warden/shared";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const cache = new Map<string, { manifest: Manifest; rawYaml: string }>();

function resolveProjectsBaseDir(): string {
  const explicit = process.env.PROJECTS_DIR;
  if (explicit) return resolve(REPO_ROOT, explicit);
  return join(REPO_ROOT, "demo");
}

function resolveProjectDir(project: string): string {
  return join(resolveProjectsBaseDir(), project);
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

// Every subdirectory of the projects base dir that has an incident.yaml is a
// connected project. Used to show what's wired up, not by the agent flow.
export function listConnectedProjects(): Manifest[] {
  const base = resolveProjectsBaseDir();
  if (!existsSync(base)) return [];

  const manifests: Manifest[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(join(base, entry.name, "incident.yaml"))) continue;
    try {
      manifests.push(loadProjectManifest(entry.name).manifest);
    } catch {
      // a broken incident.yaml shouldn't take down the whole listing
    }
  }
  return manifests;
}
