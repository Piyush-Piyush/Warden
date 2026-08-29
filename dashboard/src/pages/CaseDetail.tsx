import { useParams, Link } from "react-router-dom";
import { getCase } from "../api";
import { ApprovalPanel } from "../components/ApprovalPanel";
import { CaseStatusBadge } from "../components/CaseStatusBadge";
import { CaseTimeline } from "../components/CaseTimeline";
import { ConfidenceTag } from "../components/ConfidenceTag";
import { usePolling } from "../usePolling";

const TRUEFORGE_BASE_URL = import.meta.env.VITE_TRUEFORGE_BASE_URL ?? "http://localhost:8791";

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: theCase, error } = usePolling(() => getCase(id as string), 2500, [id]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <Link to="/cases">&larr; All cases</Link>

      {error && <p style={{ color: "#c0392b" }}>Failed to load case: {error.message}</p>}
      {!theCase && !error && <p>Loading…</p>}

      {theCase && (
        <>
          <h1 style={{ marginBottom: 4 }}>
            {theCase.service} <CaseStatusBadge status={theCase.status} />
          </h1>
          <p style={{ color: "#666" }}>
            {theCase.project} · Confidence: <ConfidenceTag confidence={theCase.confidence} /> · Created{" "}
            {new Date(theCase.created_at).toLocaleString()}
          </p>

          {theCase.root_cause_summary && (
            <p>
              <strong>Root cause:</strong> {theCase.root_cause_summary}
            </p>
          )}

          {theCase.pending_approval && (
            <div style={{ marginBottom: 24 }}>
              <ApprovalPanel caseId={theCase.id} approval={theCase.pending_approval} />
            </div>
          )}

          <h2>Timeline</h2>
          <CaseTimeline events={theCase.events} />

          <p style={{ marginTop: 24, fontSize: 13 }}>
            <a href={`${TRUEFORGE_BASE_URL}/sessions/${theCase.trueforge_session_id}`} target="_blank" rel="noreferrer">
              View full transcript in TrueForge &rarr;
            </a>
          </p>
        </>
      )}
    </div>
  );
}
