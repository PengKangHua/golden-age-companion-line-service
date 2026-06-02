import express from "express";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { CompanionStore } from "./db.js";
import { createLineWebhookRouter } from "./routes/lineWebhook.js";
import { createSimulatorRouter } from "./routes/simulator.js";
import { CheckInScheduler } from "./services/checkInScheduler.js";
import { ConversationService } from "./services/conversationService.js";

const config = loadConfig();
const store = new CompanionStore(config.databasePath);
const service = new ConversationService(store);
const scheduler = new CheckInScheduler(store, service);
const app = express();
const publicDir = join(process.cwd(), "public");

app.use("/line", createLineWebhookRouter(service, config));
app.use(express.json({ limit: "2mb" }));
app.use("/api/sim", createSimulatorRouter(service, scheduler));
app.use(express.static(publicDir));
app.get("/", (_request, response) => response.redirect("/simulator.html"));
app.get("/health", (_request, response) => response.json({ ok: true }));

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : "unknown error"
  });
});

app.listen(config.port, () => {
  console.log(`Companion LINE service listening on http://localhost:${config.port}`);
  if (!config.lineChannelAccessToken || !config.lineChannelSecret) {
    console.log("LINE credentials are not configured; local simulator and unsigned webhook development are enabled.");
  }
});
