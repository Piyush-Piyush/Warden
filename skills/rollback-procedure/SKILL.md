---
name: rollback-procedure
description: The exact contract for rolling back a deploy once you've identified a root cause — which tool to call, what arguments it needs, how to tell it actually worked, and what "verified" means before you close the case.
---

# Rolling back a deploy

This is the procedure `incident.yaml`'s `rollback` block points at. It only applies once you have MEDIUM or HIGH confidence in a specific root-cause commit — never call this speculatively.

## The contract

1. The manifest's `rollback.tool` (`rollback_deploy`) takes `{project, service, target_commit_sha, environment}`. `target_commit_sha` is the commit you are rolling **back to** — the last known-good deploy, not the one you're rolling back **from**.
2. This tool is always in the manifest's `actions.approval_required` list. Calling it pauses the turn for a human decision — that is expected and correct, not an error. Do not attempt to work around it, and do not call a different tool to achieve the same effect.
3. Before calling it, state plainly what will change and why it can't be undone by you: production will start serving `target_commit_sha` instead of whatever is running now.
4. If the human denies the approval: stop. Do not retry the same call, and do not silently substitute `restart_service` or any other action instead — a denial is a decision, not an obstacle to route around. Record why it was denied if a reason was given, and follow the manifest's `escalation` block.
5. If approved, the tool returns `{status, active_commit_sha, rolled_back_at}`. `active_commit_sha` should equal the `target_commit_sha` you requested — if it doesn't, treat the rollback as unconfirmed and say so rather than assuming success.

## What "verified" means

A rollback is not "done" the moment the tool call returns — it's done once you've observed recovery.

1. Poll the manifest's `verification.metric` every `verification.poll_interval_seconds`, up to `verification.window_minutes`.
2. Recovery means the metric drops below `verification.target_below` and stays there — a single low reading right after the rollback isn't enough if the very next reading spikes back up.
3. Report both numbers: what the metric was before (the incident value you already measured) and what it is now. "It's better" is not a report; "6.0% before, 0.3% now" is.
4. If the window elapses without recovery, say so plainly. Do not extend the window on your own or declare success on a technicality — an unresolved incident that says so honestly is more useful than a false all-clear.
