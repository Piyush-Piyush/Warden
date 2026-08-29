// Thin wrapper over TrueForge's HTTP API, using the shapes confirmed live
// against a running server (docs/development-workflow.md §14a), not the
// low-level trueforge-core library, which is an embeddable orchestration
// runtime, not a client for talking to an already-running TrueForge server.

export interface TurnStreamEvent {
  type: string;
  thread_id?: string | null;
  id?: string;
  content?: string;
  finish_reason?: string;
  tool_calls?: Array<{ id: string; source_event_id: string }>;
  state?: {
    status: string;
    message?: string;
    output?: { content?: string };
    required_actions?: TurnStreamEvent[];
  };
  [key: string]: unknown;
}

export interface TrueForgeClientOptions {
  baseUrl: string;
}

// What SessionRunner actually depends on, lets tests substitute a fake
// client without needing an interface-free duck-typed object to satisfy a
// class with private fields.
export interface TrueForgeClientLike {
  createSession(agentName: string): Promise<string>;
  streamTurn(sessionId: string, input: unknown[]): AsyncGenerator<TurnStreamEvent>;
  resumeWithApproval(
    sessionId: string,
    threadId: string,
    toolCallId: string,
    decision: { status: "allow" } | { status: "deny"; reason?: string },
  ): Promise<AsyncGenerator<TurnStreamEvent>>;
}

export class TrueForgeClient implements TrueForgeClientLike {
  private readonly baseUrl: string;

  constructor(options: TrueForgeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async createSession(agentName: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: { name: agentName } }),
    });
    if (!res.ok) throw new Error(`createSession failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { data: { id: string } };
    return body.data.id;
  }

  // Sends a turn and yields every SSE event as it arrives. Caller drives
  // what happens per event (case-store writes, approval detection, etc.);
  // this function only knows how to talk to TrueForge.
  async *streamTurn(sessionId: string, input: unknown[]): AsyncGenerator<TurnStreamEvent> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ input, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`streamTurn failed: ${res.status} ${await res.text()}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("");
        if (!dataLine) continue;
        try {
          yield JSON.parse(dataLine) as TurnStreamEvent;
        } catch {
          // non-JSON SSE line (e.g. a comment/keepalive), ignore
        }
      }
    }
  }

  // Resumes a paused turn with an approval decision. thread_id and
  // tool_call_id come from the tool.approval_required event that paused it.
  async resumeWithApproval(
    sessionId: string,
    threadId: string,
    toolCallId: string,
    decision: { status: "allow" } | { status: "deny"; reason?: string },
  ): Promise<AsyncGenerator<TurnStreamEvent>> {
    return this.streamTurn(sessionId, [
      { type: "user.tool_approval", thread_id: threadId, tool_call_id: toolCallId, approval: decision },
    ]);
  }
}
