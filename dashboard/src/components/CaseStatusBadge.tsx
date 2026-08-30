import type { CSSProperties } from "react";
import type { CaseStatus } from "@warden/shared";

// Terminal/attention states use the reserved status palette; the three
// "agent is actively working" states share one progress color and pulse,
// since they're stages of one flow, not distinct categories.
const COLORS: Record<CaseStatus, string> = {
  investigating: "var(--progress-blue)",
  executing: "var(--progress-blue)",
  verifying: "var(--progress-blue)",
  awaiting_approval: "var(--status-warning)",
  resolved: "var(--status-good)",
  failed: "var(--status-critical)",
  denied: "var(--ink-muted)",
};

const LIVE: Record<CaseStatus, boolean> = {
  investigating: true,
  executing: true,
  verifying: true,
  awaiting_approval: true,
  resolved: false,
  failed: false,
  denied: false,
};

const LABELS: Record<CaseStatus, string> = {
  investigating: "Investigating",
  awaiting_approval: "Awaiting approval",
  executing: "Executing",
  verifying: "Verifying",
  resolved: "Resolved",
  failed: "Failed",
  denied: "Denied",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className="wd-badge" style={{ "--badge-color": COLORS[status] } as CSSProperties}>
      <span className={`wd-badge__dot${LIVE[status] ? " wd-badge__dot--pulse" : ""}`} />
      {LABELS[status]}
    </span>
  );
}
