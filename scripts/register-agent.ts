// Creates or updates the Warden orchestrator agent in TrueForge from
// agents/incident-responder.agent.json. Two things are injected at
// registration time rather than baked into the checked-in template:
//   - the model name (env-configurable, since it varies per environment)
//   - mcp_servers[].require_approval_for_tools, derived from the target
//     project's incident.yaml (actions.approval_required): this is the
//     harness-level enforcement the agent's own instructions describe but
//     cannot themselves guarantee. See docs/development-workflow.md §7/§17.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifestYaml } from "../shared/src/manifest.js";

const BASE_URL = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";
const AGENT_NAME = process.env.AGENT_NAME ?? "incident-responder";
const MODEL = process.env.AGENT_MODEL ?? "google-gemini/gemini-3-6-flash";
const PROJECT = process.env.DEFAULT_PROJECT ?? "sample-checkout";
const PROJECT_DIR = join(import.meta.dirname, "..", "demo", PROJECT);

async function main() {
  const templateText = readFileSync(
    join(import.meta.dirname, "..", "agents", "incident-responder.agent.json"),
    "utf8",
  );
  const manifest = JSON.parse(templateText.replace("__MODEL__", MODEL));

  const projectManifestText = readFileSync(join(PROJECT_DIR, "incident.yaml"), "utf8");
  const projectManifest = parseManifestYaml(projectManifestText);

  const opsServerEntry = manifest.mcp_servers.find((m: { name: string }) => m.name === "ops-server");
  if (!opsServerEntry) {
    throw new Error("agent template has no mcp_servers entry named 'ops-server'");
  }
  opsServerEntry.require_approval_for_tools = projectManifest.actions.approval_required;

  console.log(`Registering agent "${AGENT_NAME}" with model ${MODEL}`);
  console.log(`  require_approval_for_tools (from ${PROJECT}/incident.yaml): ${JSON.stringify(opsServerEntry.require_approval_for_tools)}`);

  const listRes = await fetch(`${BASE_URL}/api/v1/agents`);
  if (!listRes.ok) throw new Error(`list agents failed: ${listRes.status} ${await listRes.text()}`);
  const list = await listRes.json();
  const existing = list.data?.find((a: { name: string }) => a.name === AGENT_NAME);

  if (existing) {
    const updateRes = await fetch(`${BASE_URL}/api/v1/agents/${existing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest }),
    });
    if (!updateRes.ok) throw new Error(`update agent failed: ${updateRes.status} ${await updateRes.text()}`);
    console.log(`Updated existing agent (id=${existing.id})`);
  } else {
    const createRes = await fetch(`${BASE_URL}/api/v1/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: AGENT_NAME, manifest }),
    });
    if (!createRes.ok) throw new Error(`create agent failed: ${createRes.status} ${await createRes.text()}`);
    const created = await createRes.json();
    console.log(`Created new agent (id=${created.data.id})`);
  }
}

main().catch((err) => {
  console.error("register-agent failed:", err);
  process.exit(1);
});
