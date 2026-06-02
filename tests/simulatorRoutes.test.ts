import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompanionStore } from "../src/db.js";
import { createSimulatorRouter } from "../src/routes/simulator.js";
import { CheckInScheduler } from "../src/services/checkInScheduler.js";
import { ConversationService } from "../src/services/conversationService.js";

describe("simulator routes", () => {
  let store: CompanionStore;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeEach(async () => {
    store = new CompanionStore(":memory:");
    const service = new ConversationService(store);
    const scheduler = new CheckInScheduler(store, service);
    const app = express();
    app.use(express.json());
    app.use("/api/sim", createSimulatorRouter(service, scheduler));
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

  it("lists due check-ins for local validation", async () => {
    store.createUser("route-due-2", "daily_1", "2026-05-22T00:00:00.000Z");

    const response = await fetch(`${baseUrl}/api/sim/due-check-ins?now=2026-05-24T00:00:00.000Z`);
    const data = await response.json();

    expect(data.dueUsers).toEqual([
      {
        id: "route-due-2",
        cadence: "daily",
        experimentGroup: "daily_1"
      }
    ]);
  });

  it("runs the local scheduler and exposes event logs", async () => {
    store.createUser("route-send-2", "daily_1", "2026-05-22T00:00:00.000Z");

    const runResponse = await fetch(`${baseUrl}/api/sim/run-scheduler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ now: "2026-05-24T00:00:00.000Z", limit: 10 })
    });
    const runData = await runResponse.json();

    expect(runData.sent).toHaveLength(1);

    const eventsResponse = await fetch(`${baseUrl}/api/sim/events/route-send-2`);
    const eventsData = await eventsResponse.json();

    expect(eventsData.events.map((event: { type: string }) => event.type)).toContain("check_in_sent");
  });

  it("handles simulator image events", async () => {
    const imageResponse = await fetch(`${baseUrl}/api/sim/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "route-image-user", messageId: "sim-image-1" })
    });
    const imageData = await imageResponse.json();

    expect(imageData.replies[0]).toContain("收到這張截圖");

    const eventsResponse = await fetch(`${baseUrl}/api/sim/events/route-image-user`);
    const eventsData = await eventsResponse.json();

    expect(eventsData.events.map((event: { type: string }) => event.type)).toContain("image_received");
  });

  it("records fake payment views and abandon reasons through routes", async () => {
    const viewResponse = await fetch(`${baseUrl}/api/sim/fake-payment-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "route-payment-loop", planId: "companion_plus", source: "simulator" })
    });
    expect(viewResponse.status).toBe(200);

    const abandonResponse = await fetch(`${baseUrl}/api/sim/fake-payment-abandon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "route-payment-loop",
        planId: "companion_plus",
        reason: "not_now",
        source: "simulator"
      })
    });
    expect(abandonResponse.status).toBe(200);

    const eventsResponse = await fetch(`${baseUrl}/api/sim/events/route-payment-loop`);
    const eventsData = await eventsResponse.json();

    expect(eventsData.events.map((event: { type: string }) => event.type)).toEqual([
      "fake_payment_viewed",
      "fake_payment_abandoned"
    ]);
  });

  it("returns local validation metrics", async () => {
    await fetch(`${baseUrl}/api/sim/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "route-metrics-user", text: "你好" })
    });

    const metricsResponse = await fetch(`${baseUrl}/api/sim/metrics`);
    const metrics = await metricsResponse.json();

    expect(metrics.totalUsers).toBe(1);
    expect(metrics.eventCounts.inbound_message).toBe(1);
  });
});
