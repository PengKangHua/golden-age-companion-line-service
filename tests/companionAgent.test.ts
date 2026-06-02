import { describe, expect, it } from "vitest";
import {
  analyzeUserContent,
  createCompanionReply,
  createFakePaymentOffer,
  createFirstRunMessages,
  detectCadenceIntent
} from "../src/services/companionAgent.js";

describe("companionAgent", () => {
  it("creates low-friction first-run messages with AI disclosure", () => {
    const messages = createFirstRunMessages();

    expect(messages).toHaveLength(3);
    expect(messages.join("\n")).toContain("我是 AI 做的陪伴夥伴");
    expect(messages.join("\n")).not.toContain("取名字");
    expect(messages.join("\n")).not.toContain("请选择");
  });

  it("detects cadence intent from natural language", () => {
    expect(detectCadenceIntent("你可以每天跟我說話")).toBe("daily");
    expect(detectCadenceIntent("太多了，少一點")).toBe("three_per_week");
    expect(detectCadenceIntent("先不要傳了")).toBe("paused");
  });

  it("flags suspicious payment and link messages as high risk", () => {
    const analysis = analyzeUserContent("請點連結領獎，輸入驗證碼後轉帳");

    expect(analysis.category).toBe("possible_scam");
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.shouldOfferFamilyConfirmation).toBe(true);
  });

  it("formats look-at-this replies with summary, caution, and next step", () => {
    const reply = createCompanionReply({
      text: "幫我看一下 這個投資說保證獲利",
      cadence: "three_per_week",
      isFirstRun: false
    });

    expect(reply.messages[0]).toContain("重點：");
    expect(reply.messages[0]).toContain("要注意：");
    expect(reply.messages[0]).toContain("下一步：");
  });

  it("answers directly when the user asks whether it is a real person", () => {
    const reply = createCompanionReply({
      text: "你是真人嗎",
      cadence: "three_per_week",
      isFirstRun: false
    });

    expect(reply.messages[0]).toContain("我不是真人");
    expect(reply.messages[0]).toContain("AI");
  });

  it("keeps lonely daily chat companion-first instead of pushing utility", () => {
    const reply = createCompanionReply({
      text: "今天有點悶，不知道要跟誰說話",
      cadence: "three_per_week",
      isFirstRun: false
    });

    expect(reply.messages[0]).toContain("我在");
    expect(reply.messages[0]).not.toContain("截圖");
  });

  it("exposes fake payment offers without charging", () => {
    const offer = createFakePaymentOffer("daily_companion");

    expect(offer.priceLabel).toBe("NT$149/月");
    expect(offer.ctaLabel).toBe("申請試用");
  });
});
