import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { loadFixtures } from "./fixtures.js";
import { armIncident, getScenarioState, resetScenario } from "./scenarioState.js";
import { getBisectKitHandler, getBisectKitInputShape } from "./tools/getBisectKit.js";
import { getLogsHandler, getLogsInputShape } from "./tools/getLogs.js";
import { getMetricsHandler, getMetricsInputShape } from "./tools/getMetrics.js";
import { listDeploysHandler, listDeploysInputShape } from "./tools/listDeploys.js";
import { restartServiceHandler, restartServiceInputShape } from "./tools/restartService.js";
import { rollbackDeployHandler, rollbackDeployInputShape } from "./tools/rollbackDeploy.js";

const PORT = Number(process.env.OPS_MCP_PORT ?? 4000);
const fixtures = loadFixtures();

function buildServer(): McpServer {
  const server = new McpServer({ name: "warden-ops-server", version: "0.1.0" });

  server.registerTool(
    "get_logs",
    {
      description: "Read logs for a service within a time window.",
      inputSchema: getLogsInputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      const scenario = getScenarioState(input.project, input.service);
      const result = getLogsHandler(input, fixtures.logs, scenario);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    "get_metrics",
    {
      description: "Read a metric time series for a service within a time window.",
      inputSchema: getMetricsInputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      const scenario = getScenarioState(input.project, input.service);
      const result = getMetricsHandler(input, fixtures.metrics, scenario);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    "list_deploys",
    {
      description: "List deploys for a service within a time window.",
      inputSchema: listDeploysInputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      const scenario = getScenarioState(input.project, input.service);
      const result = listDeploysHandler(input, fixtures.deploys, scenario);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    "get_bisect_kit",
    {
      description:
        "Get the reproduction harness, latency fixture, and candidate source files for the given deploy commit shas, to run in a sandbox and compare their observed failure rates.",
      inputSchema: getBisectKitInputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      const result = getBisectKitHandler(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    "rollback_deploy",
    {
      description: "Roll back a service to a prior deploy. Irreversible from this tool's point of view — changes what's running in production.",
      inputSchema: rollbackDeployInputShape,
      // destructiveHint is what makes TrueForge's default require_approval_for_tools
      // (["@write","@destructive"]) auto-gate this tool even without the explicit
      // per-name entry agents/incident-responder.agent.json also sets — two
      // independent layers agreeing, not one place that could silently drop the gate.
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async (input) => {
      const result = rollbackDeployHandler(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    "restart_service",
    {
      description: "Restart a service. Approval-gated, same as rollback_deploy.",
      inputSchema: restartServiceInputShape,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async (input) => {
      const result = restartServiceHandler(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  return server;
}

// A single McpServer/Transport pair only ever completes one `initialize`
// handshake for its whole lifetime — reusing one pair across independent
// client connections (e.g. a new one per TrueForge session) fails every
// connection after the first with "Server already initialized". The fix is
// the standard stateful-HTTP pattern: one fresh {server, transport} pair per
// MCP session id, keyed by the `Mcp-Session-Id` header the transport assigns
// on its first (`initialize`) request and the client echoes back afterward.
const sessions = new Map<string, StreamableHTTPServerTransport>();

const app = createMcpExpressApp({
  host: "0.0.0.0",
  allowedHosts: (process.env.OPS_MCP_ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(","),
});

app.post("/mcp", async (req, res) => {
  try {
    const sessionIdHeader = req.headers["mcp-session-id"];
    const existingSessionId = typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;
    let transport = existingSessionId ? sessions.get(existingSessionId) : undefined;

    if (!transport) {
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "No active session and this request is not an initialize request." },
          id: null,
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, transport as StreamableHTTPServerTransport);
        },
      });
      transport.onclose = () => {
        if (transport?.sessionId) sessions.delete(transport.sessionId);
      };
      transport.onerror = (err) => console.error("MCP transport error:", err);

      await buildServer().connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal error" });
  }
});

app.get("/mcp", async (req, res) => {
  const sessionIdHeader = req.headers["mcp-session-id"];
  const transport = typeof sessionIdHeader === "string" ? sessions.get(sessionIdHeader) : undefined;
  if (!transport) {
    res.status(400).json({ error: "unknown or missing Mcp-Session-Id" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", active_sessions: sessions.size });
});

// Admin-only — arms or clears the incident scenario for a {project,service}.
// Not exposed to the agent as an MCP tool: the webhook handler calls this
// directly (server-to-server) before creating a session, so the agent can't
// control its own test conditions. See scenarioState.ts.
app.post("/admin/reset", (req, res) => {
  const { project, service, incident_triggered_at } = req.body ?? {};
  if (typeof project !== "string" || typeof service !== "string") {
    res.status(400).json({ error: "project and service are required" });
    return;
  }
  if (incident_triggered_at) {
    armIncident(project, service, incident_triggered_at);
  } else {
    resetScenario(project, service);
  }
  res.json({ status: "ok", scenario: getScenarioState(project, service) });
});

app.listen(PORT, () => {
  console.log(`warden ops-mcp server listening on http://localhost:${PORT}/mcp`);
});
