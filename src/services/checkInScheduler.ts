import type { Cadence, UserProfile } from "../domain/types.js";
import type { CompanionStore } from "../db.js";
import type { ConversationService } from "./conversationService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CADENCE_INTERVAL_MS: Record<Cadence, number> = {
  daily: DAY_MS,
  three_per_week: Math.ceil((7 * DAY_MS) / 3),
  paused: Number.POSITIVE_INFINITY
};

export interface SentCheckIn {
  userId: string;
  message: string;
}

export class CheckInScheduler {
  constructor(
    private readonly store: CompanionStore,
    private readonly conversationService: ConversationService
  ) {}

  listDueUsers(now = new Date()): UserProfile[] {
    return this.store.listUsers().filter((user) => this.isDue(user, now));
  }

  sendDueCheckIns(now = new Date(), limit = 50): SentCheckIn[] {
    const createdAt = now.toISOString();
    return this.listDueUsers(now)
      .slice(0, limit)
      .map((user) => ({
        userId: user.id,
        message: this.conversationService.sendProactiveCheckIn(user.id, createdAt)
      }));
  }

  private isDue(user: UserProfile, now: Date): boolean {
    const interval = CADENCE_INTERVAL_MS[user.cadence];
    if (!Number.isFinite(interval)) {
      return false;
    }

    const lastCheckIn = this.store.getLastEvent(user.id, "check_in_sent");
    const anchor = new Date(lastCheckIn?.createdAt ?? user.createdAt);
    return now.getTime() - anchor.getTime() >= interval;
  }
}
