import type {
  Cadence,
  CompanionReply,
  CompanionReplyInput,
  ContentAnalysis,
  FakePaymentOffer,
  FakePaymentPlanId
} from "../domain/types.js";
import { createCompanionToneReply } from "./companionTone.js";

const HIGH_RISK_TERMS = [
  "轉帳",
  "转帐",
  "匯款",
  "汇款",
  "點連結",
  "点链接",
  "驗證碼",
  "验证码",
  "中獎",
  "中奖",
  "投資",
  "投资",
  "保證獲利",
  "保证获利",
  "帳號異常",
  "账号异常",
  "限時",
  "限时",
  "銀行",
  "银行"
];

const DOCUMENT_TERMS = [
  "報價",
  "报价",
  "合約",
  "合约",
  "DM",
  "廣告",
  "广告",
  "保健品",
  "維修",
  "维修",
  "旅遊",
  "旅游"
];

const MEDICAL_TERMS = ["血壓", "血压", "藥", "药", "醫生", "医生", "診所", "诊所", "疼", "痛"];
const WELFARE_TERMS = ["長照", "长照", "1966", "補助", "补助", "福利", "照護", "照护"];
const DISTRESS_TERMS = ["不想活", "活不下去", "很絕望", "很绝望", "想死", "沒意思", "没意思"];

export function createFirstRunMessages(): string[] {
  return [
    "你好，我以後會在 LINE 這邊陪你。\n你想聊什麼、看到什麼怪怪的訊息，或有廣告、報價看不懂，都可以直接傳給我，我陪你一起看。",
    "先跟你說一聲，我是 AI 做的陪伴夥伴，不是真人。\n重要的事我不會叫你只聽我的，我會提醒你再找家人、165、1966 或專業人員確認。",
    "你現在可以直接回我一句話就好。\n也可以傳一張你想讓我幫忙看的截圖。"
  ];
}

export function detectCadenceIntent(text: string): Cadence | undefined {
  const normalized = text.trim();

  if (/暫停|暂停|不要傳|不要传|先不要|停止/.test(normalized)) {
    return "paused";
  }

  if (/太多|少一點|少一点|不要一直|不用每天/.test(normalized)) {
    return "three_per_week";
  }

  if (/每天|天天|多一點|多一点|常一點|常一点/.test(normalized)) {
    return "daily";
  }

  if (/每週三次|每周三次|一週三次|一周三次/.test(normalized)) {
    return "three_per_week";
  }

  return undefined;
}

export function analyzeUserContent(text: string): ContentAnalysis {
  const normalized = text.trim();
  const includesUrl = /https?:\/\/|line\.me|bit\.ly|reurl\.cc|短網址|短网址/.test(normalized);

  if (DISTRESS_TERMS.some((term) => normalized.includes(term))) {
    return {
      category: "emotional_distress",
      riskLevel: "high",
      summary: "我看到你現在可能很難受，這件事不能只靠我陪你撐著。",
      caution: "如果你有傷害自己的念頭，請馬上找身邊的人，或聯絡當地緊急協助。",
      nextStep: "你可以先回我一句「有人在旁邊」或「我一個人」，我會陪你把下一步想清楚。",
      shouldOfferFamilyConfirmation: true
    };
  }

  if (includesUrl || HIGH_RISK_TERMS.some((term) => normalized.includes(term))) {
    return {
      category: "possible_scam",
      riskLevel: "high",
      summary: "這段內容有詐騙常見特徵，尤其是催你點連結、付款或提供資料。",
      caution: "先不要點連結、不要轉帳、不要給驗證碼或個人資料。",
      nextStep: "你可以把完整截圖再傳一次，我幫你整理給 165 或家人確認。",
      shouldOfferFamilyConfirmation: true
    };
  }

  if (DOCUMENT_TERMS.some((term) => normalized.includes(term))) {
    return {
      category: "document_or_offer",
      riskLevel: "caution",
      summary: "這看起來像廣告、報價或服務說明，重點要先看價格、退費和對方身分。",
      caution: "不要急著答應，也不要因為對方催促就付款。",
      nextStep: "你可以傳照片或截圖，我幫你整理成幾條容易看的重點。",
      shouldOfferFamilyConfirmation: true
    };
  }

  if (MEDICAL_TERMS.some((term) => normalized.includes(term))) {
    return {
      category: "medical",
      riskLevel: "caution",
      summary: "這和身體或用藥有關，我可以陪你整理問題，但不能替醫師判斷。",
      caution: "如果症狀突然變嚴重，先聯絡診所、藥師、家人或緊急協助。",
      nextStep: "你可以告訴我症狀什麼時候開始，我幫你整理成問醫師的話。",
      shouldOfferFamilyConfirmation: false
    };
  }

  if (WELFARE_TERMS.some((term) => normalized.includes(term))) {
    return {
      category: "welfare",
      riskLevel: "caution",
      summary: "這可能和長照或補助有關，通常要先確認資格和要準備的資料。",
      caution: "不要只看轉傳訊息，最好用官方電話或地方服務窗口確認。",
      nextStep: "你可以告訴我縣市和想申請的項目，我幫你整理要問 1966 的問題。",
      shouldOfferFamilyConfirmation: false
    };
  }

  return {
    category: "companionship",
    riskLevel: "low",
    summary: "這比較像日常聊天內容。",
    caution: "沒有看到需要馬上警覺的地方。",
    nextStep: "你可以繼續跟我說，我會陪你慢慢看。",
    shouldOfferFamilyConfirmation: false
  };
}

export function createCompanionReply(input: CompanionReplyInput): CompanionReply {
  const cadenceUpdate = detectCadenceIntent(input.text);
  if (cadenceUpdate) {
    return {
      cadenceUpdate,
      messages: [cadenceResponse(cadenceUpdate)]
    };
  }

  if (isAiIdentityQuestion(input.text)) {
    return {
      messages: [
        "我不是真人，是 AI 做的陪伴夥伴。\n但你傳來的話和東西，我會認真陪你一起看。重要的事，我也會提醒你再找真人確認。"
      ]
    };
  }

  if (isLookAtThisIntent(input.text)) {
    const cleaned = input.text.replace(/幫我看一下|帮我看一下|幫我看看|帮我看看/g, "").trim();
    const analysis = analyzeUserContent(cleaned || input.text);
    return {
      analysis,
      messages: [formatAnalysisReply(analysis)]
    };
  }

  const analysis = analyzeUserContent(input.text);
  if (analysis.riskLevel === "high" || analysis.category !== "companionship") {
    return {
      analysis,
      messages: [formatAnalysisReply(analysis)]
    };
  }

  return {
    messages: [createWarmChatReply(input.text, input.cadence)]
  };
}

export function createFakePaymentOffer(planId: FakePaymentPlanId): FakePaymentOffer {
  const offers: Record<FakePaymentPlanId, FakePaymentOffer> = {
    companion_plus: {
      planId: "companion_plus",
      title: "陪伴加一點",
      priceLabel: "NT$99/月",
      description: "我可以更常陪你聊，也記得更多你在意的事。",
      ctaLabel: "申請試用"
    },
    daily_companion: {
      planId: "daily_companion",
      title: "每天陪伴",
      priceLabel: "NT$149/月",
      description: "每天固定來問候你，也可以幫你整理生活提醒。",
      ctaLabel: "申請試用"
    },
    deep_check: {
      planId: "deep_check",
      title: "幫我仔細看",
      priceLabel: "NT$49/次",
      description: "你傳來的廣告、報價、文件，我幫你看得更仔細一點。",
      ctaLabel: "這次想試用"
    }
  };

  return offers[planId];
}

export function isLookAtThisIntent(text: string): boolean {
  return /幫我看一下|帮我看一下|幫我看看|帮我看看|這個怪怪|这个怪怪|看不懂/.test(text);
}

function isAiIdentityQuestion(text: string): boolean {
  return /你是真人|你是人嗎|你是人吗|你是不是人|你是AI|你是 AI|機器人|机器人/.test(text);
}

function cadenceResponse(cadence: Cadence): string {
  if (cadence === "paused") {
    return "好，我先不主動傳訊息給你。你想聊天或想讓我看什麼，隨時再傳給我就好。";
  }

  if (cadence === "daily") {
    return "好，那我之後每天來跟你說一聲。你如果覺得太多，直接跟我說「少一點」就可以。";
  }

  return "好，我會少一點來問候你。你想找我時，直接傳訊息就好。";
}

function formatAnalysisReply(analysis: ContentAnalysis): string {
  const prefix = analysis.riskLevel === "high" ? "我先提醒你，這件事要小心。" : "我幫你先看了一下。";
  const familyLine = analysis.shouldOfferFamilyConfirmation
    ? "\n如果你願意，我也可以幫你整理一段短短的文字，讓你轉給家人或 165 確認。"
    : "";

  return `${prefix}\n\n重點：${analysis.summary}\n要注意：${analysis.caution}\n下一步：${analysis.nextStep}${familyLine}`;
}

function createWarmChatReply(text: string, cadence: Cadence): string {
  return createCompanionToneReply(text, cadence);
}
