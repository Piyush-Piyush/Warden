import { Link } from "react-router-dom";
import { listCases } from "../api";
import { CaseStatusBadge } from "../components/CaseStatusBadge";
import { ConfidenceTag } from "../components/ConfidenceTag";
import { usePolling } from "../usePolling";

export function CaseList() {
  const { data: cases, error } = usePolling(listCases, 2500);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Cases</h1>
      {error && <p style={{ color: "#c0392b" }}>Failed to load cases: {error.message}</p>}
      {!cases && !error && <p>Loading…</p>}
      {cases && cases.length === 0 && <p style={{ color: "#999" }}>No cases yet. Send an alert to create one.</p>}
      {cases && cases.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e5e5" }}>
              <th style={{ padding: "8px 4px" }}>Service</th>
              <th style={{ padding: "8px 4px" }}>Status</th>
              <th style={{ padding: "8px 4px" }}>Confidence</th>
              <th style={{ padding: "8px 4px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "8px 4px" }}>
                  <Link to={`/cases/${c.id}`}>{c.service}</Link>
                  <div style={{ fontSize: 12, color: "#999" }}>{c.project}</div>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <CaseStatusBadge status={c.status} />
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <ConfidenceTag confidence={c.confidence} />
                </td>
                <td style={{ padding: "8px 4px", fontSize: 13, color: "#666" }}>{new Date(c.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
