export type Cadence = "three_per_week" | "daily" | "paused";

export type MessageRole = "user" | "assistant" | "system";

export type ExperimentGroup = "weekly_3" | "daily_1";

export type RiskLevel = "low" | "caution" | "high" | "unknown";

export type AnalysisCategory =
  | "companionship"
  | "possible_scam"
  | "document_or_offer"
  | "medical"
  | "welfare"
  | "emotional_distress";

export type FakePaymentPlanId =
  | "companion_plus"
  | "daily_companion"
  | "deep_check";

export type EventType =
  | "first_run_started"
  | "inbound_message"
  | "assistant_reply"
  | "look_at_this_used"
  | "image_received"
  | "cadence_changed"
  | "fake_payment_viewed"
  | "fake_payment_clicked"
  | "fake_payment_abandoned"
  | "check_in_sent"
  | "memory_deleted";

export interface UserProfile {
  id: string;
  cadence: Cadence;
  experimentGroup: ExperimentGroup;
  aiDisclosureShown: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id?: number;
  userId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ContentAnalysis {
  category: AnalysisCategory;
  riskLevel: RiskLevel;
  summary: string;
  caution: string;
  nextStep: string;
  shouldOfferFamilyConfirmation: boolean;
}

export interface CompanionReplyInput {
  text: string;
  cadence: Cadence;
  isFirstRun: boolean;
}

export interface CompanionReply {
  messages: string[];
  analysis?: ContentAnalysis;
  cadenceUpdate?: Cadence;
}

export interface FakePaymentOffer {
  planId: FakePaymentPlanId;
  title: string;
  priceLabel: string;
  description: string;
  ctaLabel: string;
}

export interface FakePaymentEvent {
  id?: number;
  userId: string;
  planId: FakePaymentPlanId;
  source: string;
  createdAt: string;
}

export interface ConversationEvent {
  id?: number;
  userId: string;
  type: EventType;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
