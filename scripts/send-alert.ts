// Dev helper: posts a synthetic alert to the webhook. Generic, takes a
// project/service as CLI args, defaults to the demo project.
// Usage: npx tsx scripts/send-alert.ts [project] [service]

const SERVER_BASE_URL = process.env.SERVER_BASE_URL ?? "http://localhost:4100";
const project = process.argv[2] ?? process.env.DEFAULT_PROJECT ?? "sample-checkout";
const service = process.argv[3] ?? "checkout-api";

const alert = {
  project,
  service,
  alert_name: `${service}-error-rate-high`,
  severity: "critical",
  metric: "error_rate_pct",
  observed_value: 6.0,
  threshold: 1.0,
  triggered_at: new Date().toISOString(),
};

const res = await fetch(`${SERVER_BASE_URL}/webhooks/alert`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(alert),
});

console.log(`${res.status} ${res.statusText}`);
console.log(await res.text());
