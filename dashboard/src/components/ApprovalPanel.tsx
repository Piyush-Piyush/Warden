import { useState } from "react";
import type { PendingApproval } from "@warden/shared";
import { approveCase, denyCase } from "../api";

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function ApprovalPanel({ caseId, approval }: { caseId: string; approval: PendingApproval }) {
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "approve" | "deny") {
    setBusy(action);
    setError(null);
    try {
      if (action === "approve") {
        await approveCase(caseId, "dashboard-user");
      } else {
        await denyCase(caseId, "dashboard-user");
      }
      // Polling on the parent page picks up the new state within a couple
      // of seconds, no need to refetch here.
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const argEntries = Object.entries(approval.tool_args);

  return (
    <div className="wd-approval">
      <div className="wd-approval__head">
        <span>⚠</span> Approval needed before this runs
      </div>
      <div className="wd-approval__lede">
        The agent wants to take an action it cannot undo on its own. Nothing happens until you decide.
      </div>
      <div className="wd-approval__tool">
        Tool: <code>{approval.tool_name}</code>
      </div>
      {argEntries.length > 0 && (
        <div className="wd-kv">
          {argEntries.map(([key, value]) => (
            <div className="wd-kv__row" key={key}>
              <div className="wd-kv__key">{key}</div>
              <div className="wd-kv__val">{formatValue(value)}</div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="wd-approval__error">{error}</div>}
      <div className="wd-approval__actions">
        <button className="wd-btn wd-btn--approve" onClick={() => handle("approve")} disabled={busy !== null}>
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button className="wd-btn wd-btn--deny" onClick={() => handle("deny")} disabled={busy !== null}>
          {busy === "deny" ? "Denying…" : "Deny"}
        </button>
      </div>
    </div>
  );
}
