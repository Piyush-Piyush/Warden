import type Database from "better-sqlite3";
import {
  decideApproval,
  getLatestPendingApprovalForCase,
  getPendingApproval,
  insertCaseEvent,
  insertPendingApproval,
  resolveCase,
  setCaseRootCause,
  updateCaseStatus,
} from "../caseStore/queries.js";
import { TrueForgeClient, type TurnStreamEvent } from "./client.js";

const CASE_EVENT_PATTERN = /<<CASE_EVENT>>(\{.*?\})<<\/CASE_EVENT>>/gs;

interface ParsedCaseEvent {
  phase: "goal" | "investigation" | "evidence" | "proposed_action" | "approval" | "result";
  summary: string;
}

function extractCaseEvents(text: string): ParsedCaseEvent[] {
  const found: ParsedCaseEvent[] = [];
  for (const match of text.matchAll(CASE_EVENT_PATTERN)) {
    try {
      const parsed = JSON.parse(match[1]) as ParsedCaseEvent;
      if (parsed.phase && parsed.summary) found.push(parsed);
    } catch {
      // malformed marker — skip rather than crash the whole turn
    }
  }
  return found;
}

// Accumulates OpenAI-style streaming tool-call deltas (arguments arrive as
// partial JSON string fragments keyed by array index, name/id only on the
// first chunk for that index) into finished {id, name, args} records.
class ToolCallAccumulator {
  private byIndex = new Map<number, { id?: string; name?: string; argsText: string }>();

  ingest(deltas: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>): void {
    for (const delta of deltas) {
      const entry = this.byIndex.get(delta.index) ?? { argsText: "" };
      if (delta.id) entry.id = delta.id;
      if (delta.function?.name) entry.name = delta.function.name;
      if (delta.function?.arguments) entry.argsText += delta.function.arguments;
      this.byIndex.set(delta.index, entry);
    }
  }

  finished(): Map<string, { name: string; args: Record<string, unknown> }> {
    const result = new Map<string, { name: string; args: Record<string, unknown> }>();
    for (const entry of this.byIndex.values()) {
      if (!entry.id || !entry.name) continue;
      let args: Record<string, unknown> = {};
      try {
        args = entry.argsText ? (JSON.parse(entry.argsText) as Record<string, unknown>) : {};
      } catch {
        // arguments didn't finish streaming or weren't valid JSON — leave empty
      }
      result.set(entry.id, { name: entry.name, args });
    }
    return result;
  }
}

export interface RunTurnResult {
  status: string;
  approvalRequired?: { threadId: string; toolCallId: string };
}

async function consumeStream(
  db: Database.Database,
  caseId: string,
  events: AsyncGenerator<TurnStreamEvent>,
): Promise<RunTurnResult> {
  const messageText = new Map<string, string>(); // message id -> accumulated content
  const toolCalls = new ToolCallAccumulator();
  let result: RunTurnResult = { status: "unknown" };

  for await (const evt of events) {
    if (evt.type === "model.message.delta") {
      const id = evt.id ?? "";
      if (evt.content) {
        messageText.set(id, (messageText.get(id) ?? "") + evt.content);
      }
      const deltaToolCalls = evt.tool_calls as
        | Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>
        | undefined;
      if (deltaToolCalls) toolCalls.ingest(deltaToolCalls);

      if (evt.finish_reason) {
        const text = messageText.get(id);
        if (text) {
          for (const parsed of extractCaseEvents(text)) {
            insertCaseEvent(db, { case_id: caseId, phase: parsed.phase, summary: parsed.summary });
          }
        }
      }
    }

    if (evt.type === "tool.approval_required" && evt.tool_calls) {
      const finished = toolCalls.finished();
      const threadId = evt.thread_id ?? "main";
      for (const ref of evt.tool_calls) {
        const info = finished.get(ref.id);
        insertPendingApproval(db, {
          id: ref.id,
          case_id: caseId,
          thread_id: threadId,
          tool_name: info?.name ?? "unknown",
          tool_args: info?.args ?? {},
        });
      }
      updateCaseStatus(db, caseId, "awaiting_approval");
      result = { status: "awaiting_approval", approvalRequired: { threadId, toolCallId: evt.tool_calls[0].id } };
    }

    if (evt.type === "turn.done") {
      const status = evt.state?.status ?? "unknown";
      result = { status };
    }
  }

  return result;
}

export class SessionRunner {
  constructor(
    private readonly db: Database.Database,
    private readonly client: TrueForgeClient,
  ) {}

  async startInvestigation(caseId: string, sessionId: string, message: string): Promise<RunTurnResult> {
    const events = this.client.streamTurn(sessionId, [{ type: "user.message", content: message }]);
    const result = await consumeStream(this.db, caseId, events);
    if (result.status !== "awaiting_approval") {
      this.finalizeNonApprovalOutcome(caseId, result);
    }
    return result;
  }

  // decision.status here is TrueForge's vocabulary ("allow"/"deny"); the
  // case-store's own vocabulary is "approved"/"denied" (matches pending_approvals'
  // CHECK constraint) — both map 1:1, kept distinct because they're genuinely
  // two different schemas agreeing, not the same value passed through twice.
  async resumeApproval(
    caseId: string,
    sessionId: string,
    approvalId: string,
    decision: { status: "allow" } | { status: "deny"; reason?: string },
    decidedBy: string,
  ): Promise<RunTurnResult> {
    const approval = getPendingApproval(this.db, approvalId);
    if (!approval) throw new Error(`no pending approval with id ${approvalId}`);

    decideApproval(this.db, approvalId, {
      status: decision.status === "allow" ? "approved" : "denied",
      decided_by: decidedBy,
    });
    insertCaseEvent(this.db, {
      case_id: caseId,
      phase: "approval",
      summary: decision.status === "allow" ? `Approved: ${approval.tool_name}` : `Denied: ${approval.tool_name}`,
    });

    if (decision.status === "deny") {
      resolveCase(this.db, caseId, "denied");
      return { status: "denied" };
    }

    updateCaseStatus(this.db, caseId, "executing");
    const events = await this.client.resumeWithApproval(sessionId, approval.thread_id, approvalId, decision);
    const result = await consumeStream(this.db, caseId, events);
    if (result.status !== "awaiting_approval") {
      this.finalizeNonApprovalOutcome(caseId, result);
    }
    return result;
  }

  private finalizeNonApprovalOutcome(caseId: string, result: RunTurnResult): void {
    if (result.status === "done") {
      updateCaseStatus(this.db, caseId, "verifying");
    } else if (result.status === "error") {
      resolveCase(this.db, caseId, "failed");
    }
  }
}

export function createSessionRunner(db: Database.Database, baseUrl: string): SessionRunner {
  return new SessionRunner(db, new TrueForgeClient({ baseUrl }));
}
