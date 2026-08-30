import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCase, getLatestPendingApprovalForCase, listCaseEvents } from "../server/src/caseStore/queries.js";
import { openDb } from "../server/src/caseStore/db.js";
import { createCase } from "../server/src/caseStore/queries.js";
import type { TrueForgeClientLike, TurnStreamEvent } from "../server/src/trueforge/client.js";
import { SessionRunner } from "../server/src/trueforge/sessionRunner.js";

// A turn that pauses for approval, or whose final message carries a "result"
// marker, still emits a generic turn.done afterward, this is the exact
// sequence that caused a real bug (turn.done overwrote the conclusive
// status). These tests replay that sequence deterministically, no LLM call
// needed to catch a regression here.
class FakeClient implements TrueForgeClientLike {
  constructor(private readonly events: TurnStreamEvent[]) {}

  async createSession(): Promise<string> {
    return "fake-session";
  }

  async *streamTurn(): AsyncGenerator<TurnStreamEvent> {
    for (const evt of this.events) yield evt;
  }

  async resumeWithApproval(): Promise<AsyncGenerator<TurnStreamEvent>> {
    const events = this.events;
    return (async function* () {
      for (const evt of events) yield evt;
    })();
  }
}

function modelMessage(id: string, content: string, toolCalls?: Array<{ index: number; id: string; function: { name: string; arguments: string } }>): TurnStreamEvent[] {
  return [
    { type: "model.message.delta", id, thread_id: "main", content, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
    { type: "model.message.delta", id, thread_id: "main", finish_reason: "stop" },
  ];
}

let dir: string;
let db: Database.Database;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "warden-runner-test-"));
  db = openDb(join(dir, "test.sqlite"));
  createCase(db, { id: "case-1", project: "p", service: "s", alert_name: null, severity: null, trueforge_session_id: "sess-1" });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("SessionRunner.consumeStream (via startInvestigation)", () => {
  it("does not let turn.done downgrade an awaiting_approval result", async () => {
    const events: TurnStreamEvent[] = [
      ...modelMessage("msg-1", "Proposing rollback.", [
        { index: 0, id: "call-1", function: { name: "rollback_deploy", arguments: '{"target_commit_sha":"9f01"}' } },
      ]),
      { type: "tool.approval_required", id: "evt-1", thread_id: "main", tool_calls: [{ id: "call-1", source_event_id: "msg-1" }] },
      { type: "turn.done", id: "evt-2", state: { status: "done" } },
    ];
    const runner = new SessionRunner(db, new FakeClient(events));

    const result = await runner.startInvestigation("case-1", "sess-1", "investigate");

    expect(result.status).toBe("awaiting_approval");
    expect(getCase(db, "case-1")?.status).toBe("awaiting_approval");

    const approval = getLatestPendingApprovalForCase(db, "case-1");
    expect(approval?.tool_name).toBe("rollback_deploy");
    expect(approval?.tool_args).toEqual({ target_commit_sha: "9f01" });
  });

  it("does not let turn.done downgrade a result-marker resolution", async () => {
    const events: TurnStreamEvent[] = [
      ...modelMessage(
        "msg-1",
        '<<CASE_EVENT>>{"phase":"result","summary":"error_rate_pct dropped from 6.0% to 0.3%"}<</CASE_EVENT>>\n\nRecovered.',
      ),
      { type: "turn.done", id: "evt-1", state: { status: "done" } },
    ];
    const runner = new SessionRunner(db, new FakeClient(events));

    const result = await runner.startInvestigation("case-1", "sess-1", "investigate");

    expect(result.status).toBe("resolved");
    expect(getCase(db, "case-1")?.status).toBe("resolved");
    expect(getCase(db, "case-1")?.resolved_at).not.toBeNull();

    const events2 = listCaseEvents(db, "case-1");
    expect(events2.some((e) => e.phase === "result")).toBe(true);
  });

  it("falls back to the generic turn.done status when nothing conclusive happened", async () => {
    const events: TurnStreamEvent[] = [
      ...modelMessage("msg-1", "Still investigating, no conclusion yet."),
      { type: "turn.done", id: "evt-1", state: { status: "done" } },
    ];
    const runner = new SessionRunner(db, new FakeClient(events));

    const result = await runner.startInvestigation("case-1", "sess-1", "investigate");

    expect(result.status).toBe("done");
    expect(getCase(db, "case-1")?.status).toBe("verifying");
  });

  it("records root_cause_summary and confidence from a proposed_action marker", async () => {
    const events: TurnStreamEvent[] = [
      ...modelMessage(
        "msg-1",
        '<<CASE_EVENT>>{"phase":"proposed_action","summary":"Roll back to 3839bc0: bisect matched bb83296 to the observed 6.0% error rate.","confidence":"high"}<</CASE_EVENT>>',
        [{ index: 0, id: "call-1", function: { name: "rollback_deploy", arguments: '{"target_commit_sha":"3839bc0"}' } }],
      ),
      { type: "tool.approval_required", id: "evt-1", thread_id: "main", tool_calls: [{ id: "call-1", source_event_id: "msg-1" }] },
      { type: "turn.done", id: "evt-2", state: { status: "done" } },
    ];
    const runner = new SessionRunner(db, new FakeClient(events));

    await runner.startInvestigation("case-1", "sess-1", "investigate");

    const theCase = getCase(db, "case-1");
    expect(theCase?.confidence).toBe("high");
    expect(theCase?.root_cause_summary).toBe("Roll back to 3839bc0: bisect matched bb83296 to the observed 6.0% error rate.");
  });

  it("ignores a proposed_action marker with a malformed confidence value", async () => {
    const events: TurnStreamEvent[] = [
      ...modelMessage(
        "msg-1",
        '<<CASE_EVENT>>{"phase":"proposed_action","summary":"Roll back to 3839bc0.","confidence":"very high"}<</CASE_EVENT>>',
      ),
      { type: "turn.done", id: "evt-1", state: { status: "done" } },
    ];
    const runner = new SessionRunner(db, new FakeClient(events));

    await runner.startInvestigation("case-1", "sess-1", "investigate");

    expect(getCase(db, "case-1")?.confidence).toBeNull();
  });
});
