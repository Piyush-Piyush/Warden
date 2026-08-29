CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  service TEXT NOT NULL,
  alert_name TEXT,
  severity TEXT,
  status TEXT NOT NULL CHECK (status IN
    ('investigating','awaiting_approval','executing','verifying','resolved','failed','denied')),
  trueforge_session_id TEXT NOT NULL,
  root_cause_summary TEXT,
  confidence TEXT CHECK (confidence IN ('low','medium','high')),
  proposed_action TEXT,          -- JSON: {tool, args}
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  phase TEXT NOT NULL CHECK (phase IN
    ('goal','investigation','evidence','proposed_action','approval','result')),
  summary TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);

CREATE TABLE IF NOT EXISTS pending_approvals (
  id TEXT PRIMARY KEY,           -- matches TrueForge's tool_call id
  case_id TEXT NOT NULL REFERENCES cases(id),
  thread_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_args_json TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied')) DEFAULT 'pending',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_case_id ON pending_approvals(case_id);
