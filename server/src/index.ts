import express from "express";
import { openDb } from "./caseStore/db.js";
import { createApprovalsRouter } from "./routes/approvals.js";
import { createCasesRouter } from "./routes/cases.js";
import { createHealthRouter } from "./routes/health.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createWebhookRouter } from "./routes/webhook.js";
import { TrueForgeClient } from "./trueforge/client.js";
import { SessionRunner } from "./trueforge/sessionRunner.js";

const PORT = Number(process.env.SERVER_PORT ?? 4100);
const TRUEFORGE_BASE_URL = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8791";

const db = openDb();
const client = new TrueForgeClient({ baseUrl: TRUEFORGE_BASE_URL });
const runner = new SessionRunner(db, client);

const app = express();
app.use(express.json());

// The dashboard is a separate origin (its own dev server / static host).
// Without this, browsers block every fetch to this API with a CORS error
// even though curl/server-to-server calls work fine (curl doesn't enforce
// same-origin policy, which is why this was missed until checking the
// dashboard specifically).
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(createHealthRouter());
app.use(createWebhookRouter(db, client, runner));
app.use(createCasesRouter(db));
app.use(createApprovalsRouter(db, runner));
app.use(createProjectsRouter());

app.listen(PORT, () => {
  console.log(`warden server listening on http://localhost:${PORT}`);
});
