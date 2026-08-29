import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadFixtures } from "./fixtures.js";
import { getLogsHandler, getLogsInputShape } from "./tools/getLogs.js";
import { getMetricsHandler, getMetricsInputShape } from "./tools/getMetrics.js";
import { listDeploysHandler, listDeploysInputShape } from "./tools/listDeploys.js";

const PORT = Number(process.env.OPS_MCP_PORT ?? 4000);
const fixtures = loadFixtures();

const server = new McpServer({ name: "warden-ops-server", version: "0.1.0" });

server.registerTool(
  "get_logs",
  {
    description: "Read logs for a service within a time window.",
    inputSchema: getLogsInputShape,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async (input) => {
    const result = getLogsHandler(input, fixtures.logs);
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
    const result = getMetricsHandler(input, fixtures.metrics);
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
    const result = listDeploysHandler(input, fixtures.deploys);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// Stateful mode: the transport tracks a session id per connected client and
// can be reused across requests. Stateless mode (sessionIdGenerator:
// undefined) explicitly forbids reusing one transport instance across
// requests ("each request must use a fresh transport") — wrong fit for a
// long-running Express process, which is why stateful mode is used here.
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
transport.onerror = (err) => console.error("MCP transport error:", err);
await server.connect(transport);

// This server is reached over a Docker network by container hostname (not
// literally "localhost"), so the default localhost-only DNS-rebinding
// allowlist has to be widened explicitly rather than relying on the
// host:'127.0.0.1' default. Hostnames only here — this check is port-agnostic.
const allowedHosts = (process.env.OPS_MCP_ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(",");
const app = createMcpExpressApp({ host: "0.0.0.0", allowedHosts });

app.post("/mcp", (req, res) => {
  transport.handleRequest(req, res, req.body).catch((err) => {
    console.error("MCP request failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal error" });
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`warden ops-mcp server listening on http://localhost:${PORT}/mcp`);
});
