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

  it("baseline and distractor show no timeouts", () => {
    expect(runHarness("9f01").timeout_rate_pct).toBe(0);
    expect(runHarness("a1b2").timeout_rate_pct).toBe(0);
  });

  it("the culprit separates from the others by a comfortable margin", () => {
    const culprit = runHarness("4c21");
    expect(culprit.timeout_rate_pct).toBeGreaterThan(4);
  });

  it("is fully deterministic across repeated runs", () => {
    const first = runHarness("4c21");
    const second = runHarness("4c21");
    expect(second.timeout_rate_pct).toBe(first.timeout_rate_pct);
  });
});
