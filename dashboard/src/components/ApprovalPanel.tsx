import { useState } from "react";
import type { PendingApproval } from "@warden/shared";
import { approveCase, denyCase } from "../api";

export function ApprovalPanel({ caseId, approval }: { caseId: string; approval: PendingApproval }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "approve" | "deny") {
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #d59b2b", borderRadius: 8, padding: 16, background: "#fff8ea" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Approval needed</div>
      <div style={{ marginBottom: 4 }}>
        Tool: <code>{approval.tool_name}</code>
      </div>
      <pre style={{ background: "#fff", padding: 8, borderRadius: 4, fontSize: 13, overflowX: "auto" }}>
        {JSON.stringify(approval.tool_args, null, 2)}
      </pre>
      {error && <div style={{ color: "#c0392b", marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => handle("approve")} disabled={busy} style={{ background: "#3a9f5c", color: "white", border: "none", borderRadius: 4, padding: "8px 16px", cursor: "pointer" }}>
          Approve
        </button>
        <button onClick={() => handle("deny")} disabled={busy} style={{ background: "#c0392b", color: "white", border: "none", borderRadius: 4, padding: "8px 16px", cursor: "pointer" }}>
          Deny
        </button>
      </div>
    </div>
  );
}
