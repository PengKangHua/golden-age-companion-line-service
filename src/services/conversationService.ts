import type { EventType, FakePaymentPlanId, UserProfile } from "../domain/types.js";
import { CompanionStore } from "../db.js";
import {
  createCompanionReply,
  createFakePaymentOffer,
  createFirstRunMessages,
  isLookAtThisIntent
} from "./companionAgent.js";

export interface InboundMessageInput {
  userId: string;
  text: string;
}

export interface InboundImageInput {
  userId: string;
  messageId: string;
  source: string;
}

export interface FakePaymentInput {
  userId: string;
  planId: FakePaymentPlanId;
  source: string;
}

export interface FakePaymentAbandonInput extends FakePaymentInput {
  reason: string;
}

export class ConversationService {
  constructor(private readonly store: CompanionStore) {}

  handleInboundMessage(input: InboundMessageInput): string[] {
    const text = normalizeText(input.text);
    const { user, isNewUser } = this.getOrCreateUser(input.userId);

    this.store.appendMessage({
      userId: user.id,
      role: "user",
      content: text
    });
    this.store.recordEvent({
      userId: user.id,
      type: "inbound_message",
      metadata: { isFirstRun: isNewUser }
    });

    const replies: string[] = [];
    if (isNewUser) {
      replies.push(...createFirstRunMessages());
      this.store.recordEvent({
        userId: user.id,
        type: "first_run_started",
        metadata: { experimentGroup: user.experimentGroup }
      });
    }

    if (isForgetMemoryIntent(text)) {
      this.store.deleteAllMemories(user.id);
      this.store.recordEvent({ userId: user.id, type: "memory_deleted" });
      replies.push("好，我不會再記這件事。你之後想重新跟我說，再慢慢說就好。");
    } else if (!isNewUser || shouldAlsoAnalyzeFirstMessage(text)) {
      if (isLookAtThisIntent(text)) {
        this.store.recordEvent({ userId: user.id, type: "look_at_this_used" });
      }

      const reply = createCompanionReply({
        text,
        cadence: user.cadence,
        isFirstRun: isNewUser
      });

      if (reply.cadenceUpdate) {
        this.store.updateCadence(user.id, reply.cadenceUpdate);
        this.store.recordEvent({
          userId: user.id,
          type: "cadence_changed",
          metadata: { cadence: reply.cadenceUpdate }
        });
      }

      replies.push(...reply.messages);
      this.captureLowRiskMemory(user.id, text);
    }

    for (const reply of replies) {
      this.store.appendMessage({
        userId: user.id,
        role: "assistant",
        content: reply
      });
      this.store.recordEvent({ userId: user.id, type: "assistant_reply" });
    }

    return replies;
  }

  handleInboundImage(input: InboundImageInput): string[] {
    const { user } = this.getOrCreateUser(input.userId);
    this.store.appendMessage({
      userId: user.id,
      role: "user",
      content: `[圖片] messageId=${input.messageId} source=${input.source}`
    });
    this.store.recordEvent({
      userId: user.id,
      type: "image_received",
      metadata: {
        messageId: input.messageId,
        source: input.source
      }
    });

    const reply =
      "我收到這張截圖了。\n如果字很多，我現在不會假裝全部看懂；你可以再補一句你最擔心哪裡，或把重要文字貼上來，我陪你一起看。";
    this.store.appendMessage({
      userId: user.id,
      role: "assistant",
      content: reply
    });
    this.store.recordEvent({ userId: user.id, type: "assistant_reply" });

    return [reply];
  }

  recordFakePaymentIntent(input: FakePaymentInput): string {
    const { user } = this.getOrCreateUser(input.userId);
    const offer = createFakePaymentOffer(input.planId);
    this.store.recordFakePaymentEvent({
      userId: user.id,
      planId: input.planId,
      source: input.source
    });
    this.store.recordEvent({
      userId: user.id,
      type: "fake_payment_clicked",
      metadata: { planId: input.planId, source: input.source }
    });

    const response = `我先幫你登記「${offer.title}」試用。\n現在還不會扣款，也沒有購買成功。等開放時，我會再把清楚的價格和內容給你看。`;
    this.store.appendMessage({
      userId: user.id,
      role: "assistant",
      content: response
    });
    this.store.recordEvent({ userId: user.id, type: "assistant_reply" });

    return response;
  }

  recordFakePaymentView(input: FakePaymentInput) {
    const { user } = this.getOrCreateUser(input.userId);
    const offer = createFakePaymentOffer(input.planId);
    this.store.recordEvent({
      userId: user.id,
      type: "fake_payment_viewed",
      metadata: {
        planId: input.planId,
        source: input.source,
        priceLabel: offer.priceLabel
      }
    });

    return offer;
  }

  recordFakePaymentAbandon(input: FakePaymentAbandonInput): void {
    const { user } = this.getOrCreateUser(input.userId);
    this.store.recordEvent({
      userId: user.id,
      type: "fake_payment_abandoned",
      metadata: {
        planId: input.planId,
        reason: input.reason,
        source: input.source
      }
    });
  }

  sendProactiveCheckIn(userId: string, createdAt?: string): string {
    const { user } = this.getOrCreateUser(userId);
    const response =
      user.cadence === "daily"
        ? "我來跟你說一聲。今天如果看到怪怪的訊息，先不要急，直接傳給我看就好。"
        : "我今天來問候一下。你最近還好嗎？想聊什麼都可以慢慢說。";

    this.store.appendMessage({
      userId: user.id,
      role: "assistant",
      content: response,
      createdAt
    });
    this.store.recordEvent({
      userId: user.id,
      type: "check_in_sent",
      metadata: { cadence: user.cadence },
      createdAt
    });
    this.store.recordEvent({ userId: user.id, type: "assistant_reply", createdAt });

    return response;
  }

  listMessages(userId: string) {
    this.getOrCreateUser(userId);
    return this.store.listMessages(userId);
  }

  listEvents(userId: string) {
    this.getOrCreateUser(userId);
    return this.store.listEvents(userId);
  }

  getMetrics() {
    const events = this.store.listAllEvents();
    const eventCounts = events.reduce(
      (counts, event) => {
        counts[event.type] = (counts[event.type] ?? 0) + 1;
        return counts;
      },
      {} as Partial<Record<EventType, number>>
    );

    return {
      totalUsers: this.store.listUsers().length,
      eventCounts,
      fakePaymentFunnel: {
        viewed: eventCounts.fake_payment_viewed ?? 0,
        clicked: eventCounts.fake_payment_clicked ?? 0,
        abandoned: eventCounts.fake_payment_abandoned ?? 0
      },
      checkInsSent: eventCounts.check_in_sent ?? 0,
      imagesReceived: eventCounts.image_received ?? 0,
      recentEvents: this.store.listAllEvents(20)
    };
  }

  private getOrCreateUser(userId: string): { user: UserProfile; isNewUser: boolean } {
    const existing = this.store.getUser(userId);
    if (existing) {
      return { user: existing, isNewUser: false };
    }

    return { user: this.store.createUser(userId), isNewUser: true };
  }

  private captureLowRiskMemory(userId: string, text: string): void {
    const nameMatch = text.match(/我叫([^，,。.\s]{1,8})/);
    if (nameMatch?.[1]) {
      this.store.upsertMemory(userId, "preferred_name", nameMatch[1].trim());
    }

    if (/喜歡散步|喜欢散步/.test(text)) {
      this.store.upsertMemory(userId, "interest_walk", "喜歡散步");
    }
  }
}

function normalizeText(text: string): string {
  const normalized = text.trim();
  return normalized.length > 0 ? normalized : "我想聊聊";
}

function shouldAlsoAnalyzeFirstMessage(text: string): boolean {
  if (
    /幫我看一下|帮我看一下|轉帳|转帐|投資|投资|報價|报价|合約|合约|血壓|血压|長照|长照|不想活|活不下去|絕望|绝望|想死|你是真人|你是人嗎|你是人吗|你是不是人|你是AI|你是 AI|機器人|机器人/.test(
      text
    )
  ) {
    return true;
  }

  return isSubstantiveFirstMessage(text);
}

function isForgetMemoryIntent(text: string): boolean {
  return /不要記|不要记|別記|别记|忘掉|刪掉記憶|删掉记忆|不要留/.test(text);
}

function isSubstantiveFirstMessage(text: string): boolean {
  const normalized = text.replace(/\s/g, "");
  if (/^(你好|您好|嗨|哈囉|哈啰|hello|我想聊聊)$/i.test(normalized)) {
    return false;
  }

  return normalized.length >= 8;
}
