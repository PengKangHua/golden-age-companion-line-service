import { describe, expect, it } from "vitest";
import { createCompanionToneReply, detectCompanionScenario } from "../src/services/companionTone.js";

describe("companionTone", () => {
  it("responds to loneliness without pushing utility", () => {
    const reply = createCompanionToneReply("今天有點悶，不知道要跟誰說話", "three_per_week");

    expect(detectCompanionScenario("今天有點悶，不知道要跟誰說話")).toBe("lonely");
    expect(reply).toContain("我在");
    expect(reply).not.toContain("截圖");
  });

  it("responds to missing family with warmth and no guilt", () => {
    const reply = createCompanionToneReply("我有點想女兒，但不想一直打擾她", "three_per_week");

    expect(detectCompanionScenario("我有點想女兒，但不想一直打擾她")).toBe("missing_family");
    expect(reply).toMatch(/想|放在心裡|掛念/);
    expect(reply).not.toContain("你應該");
  });

  it("responds to tiredness and poor sleep gently", () => {
    const reply = createCompanionToneReply("昨晚睡不好，今天很累", "daily");

    expect(detectCompanionScenario("昨晚睡不好，今天很累")).toBe("tired");
    expect(reply).toMatch(/慢慢|休息|累/);
  });

  it("responds to body discomfort without medical diagnosis", () => {
    const reply = createCompanionToneReply("今天身體有點酸，走路沒什麼力", "three_per_week");

    expect(detectCompanionScenario("今天身體有點酸，走路沒什麼力")).toBe("body_discomfort");
    expect(reply).toContain("先不要勉強");
    expect(reply).not.toContain("診斷");
  });

  it("responds to scam anxiety as companionship before utility", () => {
    const reply = createCompanionToneReply("我怕又被騙，心裡一直不安心", "three_per_week");

    expect(detectCompanionScenario("我怕又被騙，心裡一直不安心")).toBe("scam_anxiety");
    expect(reply).toContain("不用急");
    expect(reply).toContain("陪你");
  });

  it("is deterministic for the same input", () => {
    const first = createCompanionToneReply("今天想找人聊一下", "daily");
    const second = createCompanionToneReply("今天想找人聊一下", "daily");

    expect(first).toBe(second);
  });
});
