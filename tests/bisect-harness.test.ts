import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const BISECT_DIR = join(import.meta.dirname, "../demo/sample-checkout/seed/bisect");

// The sandbox environment has both `python` and `python3`; local dev
// machines vary (this Windows box only has `python`). Resolve once.
let pythonCommand = "python3";
function resolvePythonCommand(): string {
  for (const candidate of ["python3", "python"]) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("neither python3 nor python is available on PATH");
}

function runHarness(commitSha: string): { commit: string; timeout_rate_pct: number; sample_size: number } {
  const output = execFileSync(
    pythonCommand,
    ["harness.py", `./candidates/${commitSha}/service.py`, commitSha],
    { cwd: BISECT_DIR, encoding: "utf8" },
  );
  return JSON.parse(output);
}

// Regression guard on the exact thing the demo's "aha" moment depends on:
// the culprit must separate cleanly from the other two candidates, and the
// result must be identical every run (no randomness in the fixture).
describe("bisect harness", () => {
  beforeAll(() => {
    pythonCommand = resolvePythonCommand();
  });

  // Commit shas match the real commits on github.com/Piyush-Piyush/warden-sample-checkout
  // (see docs/development-workflow.md M7) - baseline, distractor, culprit.
  it("baseline and distractor show no timeouts", () => {
    expect(runHarness("7e484d6").timeout_rate_pct).toBe(0);
    expect(runHarness("3839bc0").timeout_rate_pct).toBe(0);
  });

  it("the culprit separates from the others by a comfortable margin", () => {
    const culprit = runHarness("bb83296");
    expect(culprit.timeout_rate_pct).toBeGreaterThan(4);
  });

  it("is fully deterministic across repeated runs", () => {
    const first = runHarness("bb83296");
    const second = runHarness("bb83296");
    expect(second.timeout_rate_pct).toBe(first.timeout_rate_pct);
  });
});
