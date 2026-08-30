import { Link } from "react-router-dom";
import { listCases, listConnectedProjects } from "../api";
import { CaseStatusBadge } from "../components/CaseStatusBadge";
import { ConfidenceTag } from "../components/ConfidenceTag";
import { ProjectTerminal } from "../components/ProjectTerminal";
import { usePolling } from "../usePolling";

export function CaseList() {
  const { data: cases, error } = usePolling(listCases, 2500);
  const { data: projects } = usePolling(listConnectedProjects, 15000);

  return (
    <div className="wd-page">
      {projects && projects.length > 0 && (
        <>
          <div className="wd-section-title">Connected projects</div>
          {projects.map((manifest) => (
            <ProjectTerminal manifest={manifest} key={manifest.project} />
          ))}
        </>
      )}

      <h1 style={{ fontSize: 22, margin: "24px 0 20px" }}>Cases</h1>

      {error && <p className="wd-error">Failed to load cases: {error.message}</p>}

      {!cases && !error && (
        <div>
          <div className="wd-skeleton" />
          <div className="wd-skeleton" />
          <div className="wd-skeleton" />
        </div>
      )}

      {cases && cases.length === 0 && (
        <p className="wd-empty">No cases yet. Trigger an alert against the webhook to create one.</p>
      )}

      {cases && cases.length > 0 && (
        <div className="wd-list">
          {cases.map((c) => (
            <Link to={`/cases/${c.id}`} key={c.id} className="wd-list-row wd-glass" style={{ color: "inherit" }}>
              <div>
                <div className="wd-list-row__service">{c.service}</div>
                <div className="wd-list-row__project">{c.project}</div>
              </div>
              <ConfidenceTag confidence={c.confidence} />
              <CaseStatusBadge status={c.status} />
              <div className="wd-list-row__time">{new Date(c.created_at).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
