# Warden

Warden is an incident-response agent. Given a production alert, it investigates read-only signals (logs, metrics, recent deploys) through parallel subagents, reproduces the suspected root cause by running real code in an isolated sandbox, and proposes a fix, then stops and waits for a human before doing anything irreversible. Once approved, it acts and verifies recovery before closing the case.

Everything project-specific (where a service's logs and metrics live, what's safe to do automatically versus what needs a human, how to roll it back) lives in a small YAML manifest per project, not in code. Point Warden at a different service by writing a new manifest, not by changing the agent.

## Why an agent, not a chatbot

A chatbot can describe how to debug an incident. Warden does the investigation: it pulls real data from your observability and deploy-history tools, runs a reproduction script in a sandbox to prove a cause instead of guessing one, and only pauses for a person at the one point that actually matters: right before an irreversible change to production. Read-only work happens automatically; a rollback or restart always waits for approval.

## How it's built

Warden runs on [TrueForge](https://github.com/truefoundry/trueforge), an open-source agent harness. TrueForge is what turns the underlying model into something that can act: it runs the agent loop, connects to real tools over MCP, provisions an isolated sandbox on demand, spawns and coordinates subagents, and enforces the human-approval pause before a destructive tool call, all before any of this project's own code runs. Warden's own code is deliberately small: a domain-specific MCP server, a project manifest format, the agent's instructions, and a thin server that turns a webhook alert into a tracked case.

```
demo alert  →  server/  →  TrueForge (agent loop, subagents, sandbox, approval)
                              │
                              ├── mcp/ops-server   (logs, metrics, deploys, bisect kit, rollback)
                              └── github MCP        (real commit history)
                              │
                         case-store (SQLite)  →  dashboard/ (optional)
```

- **`agents/`**: the orchestrator agent's manifest: model, instructions, connectors, sandbox config.
- **`shared/`**: the `incident.yaml` manifest schema and types shared across packages.
- **`mcp/ops-server`**: a small MCP server exposing a project's logs, metrics, deploy history, and a sandboxed bisect kit. Built to be swappable: point a real Grafana/Datadog/Loki MCP server at the same tool contract later with no agent-side changes.
- **`server/`**: webhook intake, a case-store (SQLite), and the REST API the dashboard uses. Turns an alert into a tracked case and drives it through TrueForge's turn stream.
- **`dashboard/`**: an optional web UI (case list, timeline, approve/deny). The whole system works headlessly without it. Send an alert, watch the case progress via the REST API or curl, approve via curl. TrueForge's own bundled chat UI can also drive and inspect any session directly.
- **`skills/`**: reusable instruction packs (bisect methodology, rollback procedure) TrueForge loads on demand.
- **`demo/`**: a self-contained, deletable test project (`sample-checkout`) used to develop and demo the above. Nothing outside `demo/` depends on it; delete it and Warden still runs against a real project you point it at.

## Prerequisites

- Node.js 22+
- Docker (TrueForge's own standalone mode has a known issue on native Windows, see [truefoundry/trueforge](https://github.com/truefoundry/trueforge); Docker Compose sidesteps it and is what this project is built against)
- A [Daytona](https://www.daytona.io/) API key (the sandbox provider TrueForge uses)
- An API key for a model provider TrueForge supports (Anthropic, OpenAI, Gemini, etc.)

## Setup

**1. Run TrueForge.**

```bash
git clone https://github.com/truefoundry/trueforge.git ../trueforge-runtime
cd ../trueforge-runtime
cp packages/trueforge/.env.example packages/trueforge/.env
# edit packages/trueforge/.env: uncomment HOST=0.0.0.0
docker compose up -d --build
```

Open `http://localhost:8791`. In **Settings**, add a model provider, add a Daytona sandbox provider, and add a GitHub connector (Settings → Connectors → github; needs a token with at least read access, a classic PAT with `public_repo` scope is enough).

**2. Install dependencies and build the demo project.**

```bash
npm install
cp .env.example .env
```

**3. Build and run `ops-mcp` and `server`** (both need Docker on Windows, see the Dockerfiles in `mcp/ops-server/` and `server/`; native `npm run dev` works directly on macOS/Linux):

```bash
docker build -f mcp/ops-server/Dockerfile -t warden-ops-mcp .
docker run -d --name warden-ops-mcp --network trueforge_default -p 4000:4000 \
  -e OPS_MCP_ALLOWED_HOSTS="localhost,127.0.0.1,warden-ops-mcp" warden-ops-mcp

docker build -f server/Dockerfile -t warden-server .
docker run -d --name warden-server --network trueforge_default -p 4100:4100 \
  -e TRUEFORGE_BASE_URL="http://trueforge-server-1:8790" \
  -e OPS_MCP_ADMIN_URL="http://warden-ops-mcp:4000" warden-server
```

In TrueForge's Settings → Connectors, add `ops-server` as a remote MCP server at `http://warden-ops-mcp:4000/mcp`.

**4. Register the agent:**

```bash
npm run register-agent
```

**5. Send a test alert:**

```bash
SERVER_BASE_URL=http://localhost:4100 npm run send-alert
```

Watch it progress: `curl http://localhost:4100/api/cases`. When a case reaches `awaiting_approval`, review it and approve or deny:

```bash
curl -X POST http://localhost:4100/api/cases/<id>/approve -H "Content-Type: application/json" -d '{"decided_by":"you"}'
```

**6. (Optional) Run the dashboard:**

```bash
npm run dev:dashboard
```

Open `http://localhost:5173`.

## Testing

```bash
npm test
```

Runs manifest validation, case-store, ops-mcp handler, session-runner, and bisect-harness tests. On Windows, `better-sqlite3` has no prebuilt binary for very new Node versions yet; run tests inside the `server` Docker image if `npm test` fails locally to build it:

```bash
docker build -f server/Dockerfile -t warden-server .
docker run --rm warden-server sh -c "cd /app && npx vitest run"
```

## Code review

Every pull request against this repo gets an automated review from [Qodo Merge](https://github.com/qodo-ai/pr-agent), configured in `.github/workflows/qodo-merge.yml` and `.pr_agent.toml`. It's scoped to this project's actual invariant: it's told to flag anything that weakens the approval gate around `rollback_deploy` / `restart_service`, or that touches `sessionRunner.ts`, `mcp/ops-server`, or the manifest schema without a matching test. To enable it on a fork, add an `OPENAI_KEY` secret in the repo's Actions settings; `GITHUB_TOKEN` is provided automatically.

## Adding a real project

Warden isn't tied to `sample-checkout`. To point it at a real service:

1. Write a new `incident.yaml` manifest (see `demo/sample-checkout/incident.yaml` for the schema) describing the service, where its logs/metrics/deploys live, and what's safe versus approval-gated.
2. Connect the real MCP servers it references (your actual observability and deploy-history tools) in TrueForge's Settings → Connectors.
3. Point `DEFAULT_PROJECT` / `PROJECTS_DIR` at the new manifest.

No changes to `agents/`, `mcp/ops-server`'s code, or `server/` are needed; the manifest is the entire extensibility surface.

## License

[MIT](LICENSE)
