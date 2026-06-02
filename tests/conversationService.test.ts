import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompanionStore } from "../src/db.js";
import { ConversationService } from "../src/services/conversationService.js";

describe("ConversationService", () => {
  let store: CompanionStore;
  let service: ConversationService;

  beforeEach(() => {
    store = new CompanionStore(":memory:");
    service = new ConversationService(store);
  });

  afterEach(() => {
    store.close();
  });

  it("starts with zero setup first-run messages", () => {
    const replies = service.handleInboundMessage({
      userId: "line-user-1",
      text: "你好"
    });

    expect(replies).toHaveLength(3);
    expect(replies.join("\n")).toContain("直接回我一句話");
    expect(replies.join("\n")).not.toContain("取名字");
  });

  it("updates cadence from natural language", () => {
    service.handleInboundMessage({ userId: "line-user-2", text: "你好" });
    const replies = service.handleInboundMessage({
      userId: "line-user-2",
      text: "你可以每天跟我說話"
    });

    expect(replies[0]).toContain("每天來跟你說一聲");
    expect(store.getUser("line-user-2")?.cadence).toBe("daily");
    expect(store.listEvents("line-user-2").map((event) => event.type)).toContain("cadence_changed");
  });

  it("assigns deterministic experiment groups and initial cadence", () => {
    service.handleInboundMessage({ userId: "ab", text: "你好" });
    service.handleInboundMessage({ userId: "ac", text: "你好" });

    expect(store.getUser("ab")).toMatchObject({
      experimentGroup: "daily_1",
      cadence: "daily"
    });
    expect(store.getUser("ac")).toMatchObject({
      experimentGroup: "weekly_3",
      cadence: "three_per_week"
    });
  });

  it("records first-run, inbound, assistant, and look-at-this events", () => {
    service.handleInboundMessage({
      userId: "line-user-events",
      text: "幫我看一下 這個投資說要我點連結轉帳"
    });

    const eventTypes = store.listEvents("line-user-events").map((event) => event.type);

    expect(eventTypes).toEqual([
      "inbound_message",
      "first_run_started",
      "look_at_this_used",
      "assistant_reply",
      "assistant_reply",
      "assistant_reply",
      "assistant_reply"
    ]);
  });

  it("analyzes suspicious content after first run", () => {
    service.handleInboundMessage({ userId: "line-user-3", text: "你好" });
    const replies = service.handleInboundMessage({
      userId: "line-user-3",
      text: "幫我看一下 這個投資說要我點連結轉帳"
    });

    expect(replies[0]).toContain("這件事要小心");
    expect(replies[0]).toContain("165");
  });

  it("handles emotional distress even when it is the first message", () => {
    const replies = service.handleInboundMessage({
      userId: "line-user-distress",
      text: "我覺得活不下去，很絕望"
    });

    expect(replies.join("\n")).toContain("這件事不能只靠我陪你撐著");
  });

  it("responds to substantive companion content on the first message", () => {
    const replies = service.handleInboundMessage({
      userId: "line-user-first-lonely",
      text: "今天有點悶，不知道要跟誰說話"
    });

    expect(replies).toHaveLength(4);
    expect(replies.at(-1)).toContain("我在");
  });

  it("answers AI identity questions even when asked on first message", () => {
    const replies = service.handleInboundMessage({
      userId: "line-user-ai-question",
      text: "你是真人嗎"
    });

    expect(replies.join("\n")).toContain("我不是真人");
  });

  it("forgets low-risk memories when user asks not to remember", () => {
    service.handleInboundMessage({ userId: "line-user-memory", text: "你好" });
    service.handleInboundMessage({ userId: "line-user-memory", text: "我叫阿美，我喜歡散步" });

    expect(store.listMemories("line-user-memory")).toMatchObject({
      preferred_name: "阿美",
      interest_walk: "喜歡散步"
    });

    const replies = service.handleInboundMessage({
      userId: "line-user-memory",
      text: "不要記這個"
    });

    expect(replies[0]).toContain("不會再記");
    expect(store.listMemories("line-user-memory")).toEqual({});
  });

  it("records fake payment intent without charging", () => {
    service.handleInboundMessage({ userId: "line-user-4", text: "你好" });
    const reply = service.recordFakePaymentIntent({
      userId: "line-user-4",
      planId: "companion_plus",
      source: "simulator"
    });

    expect(reply).toContain("還不會扣款");
    expect(store.listFakePaymentEvents("line-user-4")).toHaveLength(1);
    expect(store.listEvents("line-user-4").map((event) => event.type)).toContain("fake_payment_clicked");
  });

  it("records fake payment views and abandon reasons", () => {
    service.recordFakePaymentView({
      userId: "line-user-payment-loop",
      planId: "daily_companion",
      source: "simulator"
    });
    service.recordFakePaymentAbandon({
      userId: "line-user-payment-loop",
      planId: "daily_companion",
      reason: "price_unclear",
      source: "simulator"
    });

    const events = store.listEvents("line-user-payment-loop");

    expect(events.map((event) => event.type)).toEqual(["fake_payment_viewed", "fake_payment_abandoned"]);
    expect(events.at(-1)?.metadata).toMatchObject({
      planId: "daily_companion",
      reason: "price_unclear"
    });
  });

  it("handles inbound images without pretending to read the image", () => {
    const replies = service.handleInboundImage({
      userId: "line-image-user",
      messageId: "image-message-1",
      source: "simulator"
    });

    expect(replies[0]).toContain("收到這張截圖");
    expect(replies[0]).toContain("如果字很多");
    expect(replies[0]).not.toContain("我看出");
    expect(store.listEvents("line-image-user").map((event) => event.type)).toContain("image_received");
    expect(store.listMessages("line-image-user").some((message) => message.content.includes("image-message-1"))).toBe(true);
  });

  it("summarizes local validation metrics", () => {
    service.handleInboundMessage({ userId: "metrics-user", text: "你好" });
    service.handleInboundImage({ userId: "metrics-user", messageId: "metrics-image-1", source: "simulator" });
    service.recordFakePaymentView({ userId: "metrics-user", planId: "companion_plus", source: "simulator" });
    service.recordFakePaymentIntent({ userId: "metrics-user", planId: "companion_plus", source: "simulator" });
    service.recordFakePaymentAbandon({
      userId: "metrics-user",
      planId: "companion_plus",
      reason: "not_now",
      source: "simulator"
    });
    service.sendProactiveCheckIn("metrics-user", "2026-05-24T00:00:00.000Z");

    const metrics = service.getMetrics();

    expect(metrics.totalUsers).toBe(1);
    expect(metrics.eventCounts.inbound_message).toBe(1);
    expect(metrics.fakePaymentFunnel).toEqual({
      viewed: 1,
      clicked: 1,
      abandoned: 1
    });
    expect(metrics.checkInsSent).toBe(1);
    expect(metrics.imagesReceived).toBe(1);
    expect(metrics.recentEvents.at(-1)?.type).toBe("assistant_reply");
  });
});
