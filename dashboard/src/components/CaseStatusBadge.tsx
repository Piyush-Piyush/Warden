import type { CaseStatus } from "@warden/shared";

const COLORS: Record<CaseStatus, string> = {
  investigating: "#5b7bd5",
  awaiting_approval: "#d59b2b",
  executing: "#d59b2b",
  verifying: "#5b7bd5",
  resolved: "#3a9f5c",
  failed: "#c0392b",
  denied: "#8b8b8b",
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
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        color: "white",
        backgroundColor: COLORS[status],
      }}
    >
      {LABELS[status]}
    </span>
  );
}
