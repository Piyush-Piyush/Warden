import express from "express";
import { openDb } from "./caseStore/db.js";
import { createApprovalsRouter } from "./routes/approvals.js";
import { createCasesRouter } from "./routes/cases.js";
import { createHealthRouter } from "./routes/health.js";
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
app.use(createHealthRouter());
app.use(createWebhookRouter(db, client, runner));
app.use(createCasesRouter(db));
app.use(createApprovalsRouter(db, runner));

app.listen(PORT, () => {
  console.log(`warden server listening on http://localhost:${PORT}`);
});
