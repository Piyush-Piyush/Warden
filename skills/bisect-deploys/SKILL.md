---
name: bisect-deploys
description: How to interpret a deploy-bisect run when investigating an incident's root cause, reading the sandbox harness output, tie-breaking close results, and recognizing when the evidence is inconclusive rather than guessing.
---

# Bisecting deploys to find a root cause

You have a set of candidate deploys near an incident's inflection point and a reproduction harness that measures each candidate's behavior under the same simulated conditions. This skill covers how to read and trust that output.

## Running the bisect

1. Call `get_bisect_kit` with the candidate commit shas. It returns the harness script, a fixed latency fixture, and each candidate's source file.
2. Write every returned file into the sandbox exactly as given; the harness imports the fixture and candidate by their given paths, so don't rename anything.
3. Run the harness once per candidate: `python3 harness.py candidates/<sha>/service.py <sha>`. Each run prints one JSON line: `{"commit": "<sha>", "timeout_rate_pct": <number>, "sample_size": <number>}`.
4. Run every candidate you were given. Do not stop early once one looks promising; a partial bisect is not evidence, it's a guess with extra steps.

## Reading the result

Compare each candidate's `timeout_rate_pct` against the metrics investigator's observed error rate from the actual incident.

- **Clear match**: exactly one candidate's rate is close to the observed rate (within a couple of percentage points) and clearly separated from the others (the next-closest candidate differs by several points, not a fraction of one). This is a confident root-cause candidate.
- **Close tie**: two or more candidates land within a point or two of each other and both are plausible against the observed rate. Do not pick one arbitrarily; this is a MEDIUM confidence situation at best. Say explicitly that the bisect did not cleanly separate the candidates, and name which ones remain plausible.
- **No match**: every candidate's rate is far from the observed rate. The bisect has ruled out the candidates you tested, not identified a cause. This is LOW confidence, say so, and do not propose a fix.

## What counts as inconclusive, not evidence

- A sandbox run that errors, times out, or produces no parseable output for a candidate. Report that candidate's result as unknown, not as a 0% or negative result.
- A candidate the deploys investigator was unsure about (e.g. an approximate deploy timestamp). Note the uncertainty in your confidence statement rather than treating the bisect result as settling it.
- Never substitute a plausible-sounding number for one you didn't actually observe from a harness run. If a run fails, that candidate's status is "not tested," not "presumed clean."
