import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompanionStore } from "../src/db.js";
import { createLineWebhookRouter } from "../src/routes/lineWebhook.js";
import { ConversationService } from "../src/services/conversationService.js";

describe("LINE webhook", () => {
  let store: CompanionStore;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeEach(async () => {
    store = new CompanionStore(":memory:");
    const service = new ConversationService(store);
    const app = express();
    app.use(
      "/line",
      createLineWebhookRouter(service, {
        port: 0,
        databasePath: ":memory:"
      })
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected test server to listen on a random port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    store.close();
  });

  it("handles LINE image message events without credentials", async () => {
    const response = await fetch(`${baseUrl}/line/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            type: "message",
            replyToken: "reply-token",
            source: { type: "user", userId: "line-image-route-user" },
            message: {
              type: "image",
              id: "line-image-1",
              contentProvider: { type: "line" }
            }
          }
        ]
      })
    });
    const data = await response.json();

    expect(data.results[0]).toMatchObject({ eventType: "message", replies: 1 });
    expect(store.listEvents("line-image-route-user").map((event) => event.type)).toContain("image_received");
  });
});
