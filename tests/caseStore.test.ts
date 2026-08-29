import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../server/src/caseStore/db.js";
import {
  createCase,
  decideApproval,
  getCase,
  getLatestPendingApprovalForCase,
  getPendingApproval,
  insertCaseEvent,
  insertPendingApproval,
  listCaseEvents,
  listCases,
  resolveCase,
  setCaseRootCause,
  updateCaseStatus,
} from "../server/src/caseStore/queries.js";

let dir: string;
let db: Database.Database;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "warden-test-"));
  db = openDb(join(dir, "test.sqlite"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("caseStore", () => {
  it("creates a case and reads it back", () => {
    const created = createCase(db, {
      id: "case-1",
      project: "sample-checkout",
      service: "checkout-api",
      alert_name: "checkout-api-error-rate-high",
      severity: "critical",
      trueforge_session_id: "session-1",
    });
    expect(created.status).toBe("investigating");
    expect(created.proposed_action).toBeNull();

    const fetched = getCase(db, "case-1");
    expect(fetched).toEqual(created);
  });

  it("transitions status and lists cases newest-first", () => {
    createCase(db, { id: "case-1", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-1" });
    createCase(db, { id: "case-2", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-2" });

    updateCaseStatus(db, "case-1", "awaiting_approval");
    expect(getCase(db, "case-1")?.status).toBe("awaiting_approval");

    const all = listCases(db);
    expect(all.map((c) => c.id)).toEqual(["case-2", "case-1"]);
  });

  it("stores and round-trips the proposed_action JSON", () => {
    createCase(db, { id: "case-1", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-1" });
    setCaseRootCause(db, "case-1", {
      root_cause_summary: "deploy 4c21 reduced the timeout budget",
      confidence: "high",
      proposed_action: { tool: "rollback_deploy", args: { target_commit_sha: "9f01" } },
    });

    const fetched = getCase(db, "case-1");
    expect(fetched?.confidence).toBe("high");
    expect(fetched?.proposed_action).toEqual({ tool: "rollback_deploy", args: { target_commit_sha: "9f01" } });
  });

  it("resolves a case with a terminal status and resolved_at", () => {
    createCase(db, { id: "case-1", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-1" });
    resolveCase(db, "case-1", "resolved");

    const fetched = getCase(db, "case-1");
    expect(fetched?.status).toBe("resolved");
    expect(fetched?.resolved_at).not.toBeNull();
  });

  it("inserts and lists case events in order", () => {
    createCase(db, { id: "case-1", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-1" });
    insertCaseEvent(db, { case_id: "case-1", phase: "investigation", summary: "logs investigator started" });
    insertCaseEvent(db, { case_id: "case-1", phase: "evidence", summary: "4c21 measured 6.0% timeout rate", detail: { commit: "4c21" } });

    const events = listCaseEvents(db, "case-1");
    expect(events.map((e) => e.phase)).toEqual(["investigation", "evidence"]);
    expect(events[1].detail).toEqual({ commit: "4c21" });
  });

  it("inserts a pending approval and resolves it via decideApproval", () => {
    createCase(db, { id: "case-1", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-1" });
    insertPendingApproval(db, {
      id: "call-1",
      case_id: "case-1",
      thread_id: "main",
      tool_name: "rollback_deploy",
      tool_args: { target_commit_sha: "9f01" },
    });

    expect(getLatestPendingApprovalForCase(db, "case-1")?.status).toBe("pending");

    decideApproval(db, "call-1", { status: "approved", decided_by: "on-call-lead" });

    const decided = getPendingApproval(db, "call-1");
    expect(decided?.status).toBe("approved");
    expect(decided?.decided_by).toBe("on-call-lead");
    // no longer "the latest pending" once decided
    expect(getLatestPendingApprovalForCase(db, "case-1")).toBeUndefined();
  });
});
