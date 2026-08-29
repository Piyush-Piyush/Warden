// M0 tool: proves the live TrueForge server behaves the way the plan assumes.
// Creates a throwaway agent, opens a session, sends a turn, and dumps every
// raw SSE event to stdout so the shapes can be diffed against
// docs/development-workflow.md §14a. Not part of the product; dev-only.

const BASE_URL = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";
const MODEL = process.env.PROBE_MODEL ?? "google-gemini/gemini-3-6-flash";

async function main() {
  const agentName = `probe-agent-${Date.now()}`;

  const agentRes = await fetch(`${BASE_URL}/api/v1/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: agentName,
      manifest: {
        model: { name: MODEL },
        instructions: "You are a smoke-test agent. Reply in one short sentence.",
      },
    }),
  });
  if (!agentRes.ok) {
    throw new Error(`create agent failed: ${agentRes.status} ${await agentRes.text()}`);
  }
  const agent = await agentRes.json();
  console.log("=== agent created ===");
  console.log(JSON.stringify(agent, null, 2));

  const sessionRes = await fetch(`${BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent: { name: agentName } }),
  });
  if (!sessionRes.ok) {
    throw new Error(`create session failed: ${sessionRes.status} ${await sessionRes.text()}`);
  }
  const session = await sessionRes.json();
  console.log("=== session created ===");
  console.log(JSON.stringify(session, null, 2));

  const sessionId = session.id ?? session.session_id ?? session.data?.id;
  if (!sessionId) {
    throw new Error(`could not find session id in response: ${JSON.stringify(session)}`);
  }

  const turnRes = await fetch(`${BASE_URL}/api/v1/sessions/${sessionId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      input: [{ type: "user.message", content: "Say hello in exactly five words." }],
      stream: true,
    }),
  });
  if (!turnRes.ok || !turnRes.body) {
    throw new Error(`create turn failed: ${turnRes.status} ${await turnRes.text()}`);
  }

  console.log("=== turn stream (raw SSE) ===");
  const reader = turnRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const seenTypes = new Set<string>();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!dataLines) continue;
      try {
        const parsed = JSON.parse(dataLines);
        seenTypes.add(parsed.type ?? "unknown");
        console.log(JSON.stringify(parsed));
      } catch {
        console.log("RAW:", dataLines);
      }
    }
  }

  console.log("=== event types observed ===");
  console.log([...seenTypes].sort());
  console.log("=== probe complete ===");
}

main().catch((err) => {
  console.error("PROBE FAILED:", err);
  process.exit(1);
});
