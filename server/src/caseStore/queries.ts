import type Database from "better-sqlite3";
import type {
  ApprovalStatus,
  Case,
  CaseEvent,
  CaseEventPhase,
  CaseStatus,
  Confidence,
  PendingApproval,
  ProposedAction,
} from "@warden/shared";

interface CaseRow {
  id: string;
  project: string;
  service: string;
  alert_name: string | null;
  severity: string | null;
  status: CaseStatus;
  trueforge_session_id: string;
  root_cause_summary: string | null;
  confidence: Confidence | null;
  proposed_action: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

function rowToCase(row: CaseRow): Case {
  return {
    ...row,
    proposed_action: row.proposed_action ? (JSON.parse(row.proposed_action) as ProposedAction) : null,
  };
}

export function createCase(
  db: Database.Database,
  input: {
    id: string;
    project: string;
    service: string;
    alert_name: string | null;
    severity: string | null;
    trueforge_session_id: string;
  },
): Case {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO cases (id, project, service, alert_name, severity, status, trueforge_session_id, created_at, updated_at)
     VALUES (@id, @project, @service, @alert_name, @severity, 'investigating', @trueforge_session_id, @created_at, @updated_at)`,
  ).run({ ...input, created_at: now, updated_at: now });
  return getCase(db, input.id) as Case;
}

export function getCase(db: Database.Database, id: string): Case | undefined {
  const row = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(id) as CaseRow | undefined;
  return row ? rowToCase(row) : undefined;
}

export function listCases(db: Database.Database): Case[] {
  // rowid as a tiebreak: two cases created within the same millisecond would
  // otherwise sort arbitrarily since created_at alone isn't unique.
  const rows = db.prepare(`SELECT * FROM cases ORDER BY created_at DESC, rowid DESC`).all() as CaseRow[];
  return rows.map(rowToCase);
}

export function updateCaseStatus(db: Database.Database, id: string, status: CaseStatus): void {
  db.prepare(`UPDATE cases SET status = ?, updated_at = ? WHERE id = ?`).run(status, new Date().toISOString(), id);
}

export function setCaseRootCause(
  db: Database.Database,
  id: string,
  input: { root_cause_summary: string; confidence: Confidence; proposed_action: ProposedAction | null },
): void {
  db.prepare(
    `UPDATE cases SET root_cause_summary = ?, confidence = ?, proposed_action = ?, updated_at = ? WHERE id = ?`,
  ).run(
    input.root_cause_summary,
    input.confidence,
    input.proposed_action ? JSON.stringify(input.proposed_action) : null,
    new Date().toISOString(),
    id,
  );
}

export function resolveCase(db: Database.Database, id: string, status: "resolved" | "failed" | "denied"): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE cases SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?`).run(status, now, now, id);
}

export function insertCaseEvent(
  db: Database.Database,
  input: { case_id: string; phase: CaseEventPhase; summary: string; detail?: unknown },
): CaseEvent {
  const now = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO case_events (case_id, phase, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(input.case_id, input.phase, input.summary, input.detail !== undefined ? JSON.stringify(input.detail) : null, now);
  return {
    id: Number(result.lastInsertRowid),
    case_id: input.case_id,
    phase: input.phase,
    summary: input.summary,
    detail: input.detail ?? null,
    created_at: now,
  };
}

export function listCaseEvents(db: Database.Database, caseId: string): CaseEvent[] {
  const rows = db
    .prepare(`SELECT * FROM case_events WHERE case_id = ? ORDER BY id ASC`)
    .all(caseId) as Array<{ id: number; case_id: string; phase: CaseEventPhase; summary: string; detail_json: string | null; created_at: string }>;
  return rows.map((row) => ({
    id: row.id,
    case_id: row.case_id,
    phase: row.phase,
    summary: row.summary,
    detail: row.detail_json ? JSON.parse(row.detail_json) : null,
    created_at: row.created_at,
  }));
}

interface PendingApprovalRow {
  id: string;
  case_id: string;
  thread_id: string;
  tool_name: string;
  tool_args_json: string;
  rationale: string | null;
  status: ApprovalStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

function rowToApproval(row: PendingApprovalRow): PendingApproval {
  return {
    id: row.id,
    case_id: row.case_id,
    thread_id: row.thread_id,
    tool_name: row.tool_name,
    tool_args: JSON.parse(row.tool_args_json) as Record<string, unknown>,
    rationale: row.rationale,
    status: row.status,
    created_at: row.created_at,
    decided_at: row.decided_at,
    decided_by: row.decided_by,
  };
}

export function insertPendingApproval(
  db: Database.Database,
  input: {
    id: string;
    case_id: string;
    thread_id: string;
    tool_name: string;
    tool_args: Record<string, unknown>;
    rationale?: string;
  },
): PendingApproval {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO pending_approvals (id, case_id, thread_id, tool_name, tool_args_json, rationale, status, created_at)
     VALUES (@id, @case_id, @thread_id, @tool_name, @tool_args_json, @rationale, 'pending', @created_at)`,
  ).run({
    id: input.id,
    case_id: input.case_id,
    thread_id: input.thread_id,
    tool_name: input.tool_name,
    tool_args_json: JSON.stringify(input.tool_args),
    rationale: input.rationale ?? null,
    created_at: now,
  });
  return getPendingApproval(db, input.id) as PendingApproval;
}

export function getPendingApproval(db: Database.Database, id: string): PendingApproval | undefined {
  const row = db.prepare(`SELECT * FROM pending_approvals WHERE id = ?`).get(id) as PendingApprovalRow | undefined;
  return row ? rowToApproval(row) : undefined;
}

export function getLatestPendingApprovalForCase(db: Database.Database, caseId: string): PendingApproval | undefined {
  const row = db
    .prepare(`SELECT * FROM pending_approvals WHERE case_id = ? AND status = 'pending' ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get(caseId) as PendingApprovalRow | undefined;
  return row ? rowToApproval(row) : undefined;
}

export function decideApproval(
  db: Database.Database,
  id: string,
  input: { status: "approved" | "denied"; decided_by: string },
): void {
  db.prepare(`UPDATE pending_approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`).run(
    input.status,
    new Date().toISOString(),
    input.decided_by,
    id,
  );
}
