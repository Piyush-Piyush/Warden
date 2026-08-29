// Mutable per-{project,service} incident state. Set only via the /admin/reset
// endpoint the webhook handler calls before creating a TrueForge session —
// never exposed to the agent as a tool, so the agent can't control its own
// test conditions. This is what makes the demo "real, not faked": get_metrics
// / get_logs / list_deploys compute their answers from this state rather than
// from a second, disconnected fixture.

export interface ScenarioState {
  incident_triggered_at: string | null;
  rollback_performed_at: string | null;
  rolled_back_to_commit_sha: string | null;
}

const EMPTY_STATE: ScenarioState = {
  incident_triggered_at: null,
  rollback_performed_at: null,
  rolled_back_to_commit_sha: null,
};

const states = new Map<string, ScenarioState>();

function key(project: string, service: string): string {
  return `${project}:${service}`;
}

export function getScenarioState(project: string, service: string): ScenarioState {
  return states.get(key(project, service)) ?? EMPTY_STATE;
}

export function armIncident(project: string, service: string, incidentTriggeredAt: string): void {
  states.set(key(project, service), {
    incident_triggered_at: incidentTriggeredAt,
    rollback_performed_at: null,
    rolled_back_to_commit_sha: null,
  });
}

export function recordRollback(project: string, service: string, rolledBackAt: string, targetCommitSha: string): void {
  const current = getScenarioState(project, service);
  states.set(key(project, service), {
    ...current,
    rollback_performed_at: rolledBackAt,
    rolled_back_to_commit_sha: targetCommitSha,
  });
}

export function resetScenario(project: string, service: string): void {
  states.delete(key(project, service));
}

// How long after a rollback the metric/log recovery curve takes to fully
// settle back to baseline. Compressed for demo pacing — the manifest's
// verification.window_minutes is the semantic value stated to a human;
// this is the actual fixture timescale. See docs/development-workflow.md §13.
export const RECOVERY_DURATION_SECONDS = 30;
