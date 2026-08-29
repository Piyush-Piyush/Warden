import type { CaseEvent, CaseEventPhase } from "@warden/shared";

const PHASE_LABELS: Record<CaseEventPhase, string> = {
  goal: "Goal",
  investigation: "Investigation",
  evidence: "Evidence",
  proposed_action: "Proposed action",
  approval: "Approval",
  result: "Result",
};

const PHASE_COLORS: Record<CaseEventPhase, string> = {
  goal: "#8b8b8b",
  investigation: "#5b7bd5",
  evidence: "#5b7bd5",
  proposed_action: "#d59b2b",
  approval: "#d59b2b",
  result: "#3a9f5c",
};

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  if (events.length === 0) {
    return <p style={{ color: "#999" }}>No events yet.</p>;
  }

  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, borderLeft: "2px solid #e5e5e5" }}>
      {events.map((event) => (
        <li key={event.id} style={{ padding: "8px 0 8px 16px", marginLeft: -1, borderLeft: `3px solid ${PHASE_COLORS[event.phase]}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: PHASE_COLORS[event.phase], textTransform: "uppercase" }}>
            {PHASE_LABELS[event.phase]}
          </div>
          <div style={{ fontSize: 15 }}>{event.summary}</div>
          <div style={{ fontSize: 12, color: "#999" }}>{new Date(event.created_at).toLocaleString()}</div>
        </li>
      ))}
    </ol>
  );
}
