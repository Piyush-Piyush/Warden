import type { CSSProperties } from "react";
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
  goal: "var(--ink-muted)",
  investigation: "var(--progress-blue)",
  evidence: "var(--progress-blue)",
  proposed_action: "var(--status-warning)",
  approval: "var(--status-warning)",
  result: "var(--status-good)",
};

const PHASE_ICON: Record<CaseEventPhase, string> = {
  goal: "⚑",
  investigation: "◎",
  evidence: "✓",
  proposed_action: "→",
  approval: "!",
  result: "✓",
};

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  if (events.length === 0) {
    return <p className="wd-empty">No events yet. The agent's first update will appear here.</p>;
  }

  return (
    <ol className="wd-timeline">
      {events.map((event, i) => (
        <li
          key={event.id}
          className={`wd-timeline__item${i === events.length - 1 ? " wd-timeline__item--latest" : ""}`}
          style={{ "--badge-color": PHASE_COLORS[event.phase], animationDelay: `${Math.min(i, 6) * 40}ms` } as CSSProperties}
        >
          <span className="wd-timeline__node">{PHASE_ICON[event.phase]}</span>
          <div className="wd-timeline__body">
            <div className="wd-timeline__phase">{PHASE_LABELS[event.phase]}</div>
            <div className="wd-timeline__summary">{event.summary}</div>
            <div className="wd-timeline__time">{new Date(event.created_at).toLocaleString()}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
