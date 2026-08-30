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
    <div className="wd-page">
      <Link to="/cases" className="wd-back">
        &larr; All cases
      </Link>

      {error && <p className="wd-error">Failed to load case: {error.message}</p>}
      {!theCase && !error && <div className="wd-skeleton" />}

      {theCase && (
        <>
          <div className="wd-title-row">
            <h1>{theCase.service}</h1>
            <CaseStatusBadge status={theCase.status} />
          </div>
          <div className="wd-meta">
            <span>{theCase.project}</span>
            <span className="wd-meta__sep">·</span>
            <ConfidenceTag confidence={theCase.confidence} />
            <span className="wd-meta__sep">·</span>
            <span>Created {new Date(theCase.created_at).toLocaleString()}</span>
          </div>

          {theCase.root_cause_summary && (
            <div className="wd-root-cause wd-glass">
              <strong>Root cause:</strong> {theCase.root_cause_summary}
            </div>
          )}

          {theCase.pending_approval && <ApprovalPanel caseId={theCase.id} approval={theCase.pending_approval} />}

          <div className="wd-section-title">Timeline</div>
          <CaseTimeline events={theCase.events} />

          <a
            className="wd-transcript-link"
            href={`${TRUEFORGE_BASE_URL}/sessions/${theCase.trueforge_session_id}`}
            target="_blank"
            rel="noreferrer"
          >
            View full transcript in TrueForge &rarr;
          </a>
        </>
      )}
    </div>
  );
}
