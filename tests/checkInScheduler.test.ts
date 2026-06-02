import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompanionStore } from "../src/db.js";
import { CheckInScheduler } from "../src/services/checkInScheduler.js";
import { ConversationService } from "../src/services/conversationService.js";

describe("CheckInScheduler", () => {
  let store: CompanionStore;
  let service: ConversationService;
  let scheduler: CheckInScheduler;

  const now = new Date("2026-05-24T00:00:00.000Z");

  beforeEach(() => {
    store = new CompanionStore(":memory:");
    service = new ConversationService(store);
    scheduler = new CheckInScheduler(store, service);
  });

  afterEach(() => {
    store.close();
  });

  it("lists daily users as due after 24 hours", () => {
    store.createUser("daily-due-2", "daily_1", "2026-05-22T23:59:00.000Z");
    store.createUser("daily-not-due-2", "daily_1", "2026-05-23T01:00:00.000Z");

    expect(scheduler.listDueUsers(now).map((user) => user.id)).toEqual(["daily-due-2"]);
  });

  it("lists three-per-week users as due after 56 hours", () => {
    store.createUser("weekly-due-1", "weekly_3", "2026-05-21T15:59:00.000Z");
    store.createUser("weekly-not-due-1", "weekly_3", "2026-05-21T16:30:00.000Z");

    expect(scheduler.listDueUsers(now).map((user) => user.id)).toEqual(["weekly-due-1"]);
  });

  it("does not list paused users as due", () => {
    store.createUser("paused-user-1", "weekly_3", "2026-05-20T00:00:00.000Z");
    store.updateCadence("paused-user-1", "paused");

    expect(scheduler.listDueUsers(now)).toEqual([]);
  });

  it("uses the last check-in event when deciding whether a user is due", () => {
    store.createUser("daily-with-recent-checkin-2", "daily_1", "2026-05-20T00:00:00.000Z");
    store.recordEvent({
      userId: "daily-with-recent-checkin-2",
      type: "check_in_sent",
      createdAt: "2026-05-23T12:30:00.000Z"
    });

    expect(scheduler.listDueUsers(now)).toEqual([]);
  });

  it("sends due check-ins and records check-in events", () => {
    store.createUser("daily-send-2", "daily_1", "2026-05-22T23:59:00.000Z");

    const sent = scheduler.sendDueCheckIns(now, 10);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ userId: "daily-send-2" });
    expect(store.listEvents("daily-send-2").map((event) => event.type)).toContain("check_in_sent");
    expect(store.listMessages("daily-send-2").at(-1)?.content).toContain("我來跟你說一聲");
  });
});
