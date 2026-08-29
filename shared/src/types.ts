export type CaseStatus =
  | "investigating"
  | "awaiting_approval"
  | "executing"
  | "verifying"
  | "resolved"
  | "failed"
  | "denied";

export type Confidence = "low" | "medium" | "high";

export type CaseEventPhase =
  | "goal"
  | "investigation"
  | "evidence"
  | "proposed_action"
  | "approval"
  | "result";

export type ApprovalStatus = "pending" | "approved" | "denied";

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface Case {
  id: string;
  project: string;
  service: string;
  alert_name: string | null;
  severity: string | null;
  status: CaseStatus;
  trueforge_session_id: string;
  root_cause_summary: string | null;
  confidence: Confidence | null;
  proposed_action: ProposedAction | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CaseEvent {
  id: number;
  case_id: string;
  phase: CaseEventPhase;
  summary: string;
  detail: unknown | null;
  created_at: string;
}

export interface PendingApproval {
  id: string;
  case_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  rationale: string | null;
  status: ApprovalStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}
