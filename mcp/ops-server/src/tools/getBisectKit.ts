import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

export const getBisectKitInputShape = {
  project: z.string(),
  commit_shas: z.array(z.string()).min(1),
};

const getBisectKitInput = z.object(getBisectKitInputShape);
export type GetBisectKitInput = z.infer<typeof getBisectKitInput>;

export interface KitFile {
  path: string;
  content: string;
}

export interface CandidateKit {
  commit_sha: string;
  files: KitFile[];
}

export interface GetBisectKitOutput {
  harness: KitFile;
  upstream_latency: KitFile;
  candidates: CandidateKit[];
}

// Same computed default project dir as fixtures.ts, kept independent since
// this tool reads raw source files (to hand to the sandbox), not JSON
// fixtures parsed into memory at startup.
function resolveProjectDir(): string {
  const explicit = process.env.OPS_MCP_PROJECT_DIR;
  const packageDir = resolve(import.meta.dirname, "../..");
  const repoRoot = resolve(packageDir, "../..");
  if (explicit) return resolve(repoRoot, explicit);
  const projectName = process.env.DEFAULT_PROJECT ?? "sample-checkout";
  return join(repoRoot, "demo", projectName);
}

export function getBisectKitHandler(input: GetBisectKitInput): GetBisectKitOutput {
  const bisectDir = join(resolveProjectDir(), "seed", "bisect");

  const harness: KitFile = {
    path: "harness.py",
    content: readFileSync(join(bisectDir, "harness.py"), "utf8"),
  };
  const upstreamLatency: KitFile = {
    path: "upstream_latency.json",
    content: readFileSync(join(bisectDir, "upstream_latency.json"), "utf8"),
  };

  const candidates: CandidateKit[] = input.commit_shas.map((sha) => ({
    commit_sha: sha,
    files: [
      {
        path: `candidates/${sha}/service.py`,
        content: readFileSync(join(bisectDir, "candidates", sha, "service.py"), "utf8"),
      },
    ],
  }));

  return { harness, upstream_latency: upstreamLatency, candidates };
}
