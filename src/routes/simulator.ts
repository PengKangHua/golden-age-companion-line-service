import { Router } from "express";
import { z } from "zod";
import type { FakePaymentPlanId } from "../domain/types.js";
import type { CheckInScheduler } from "../services/checkInScheduler.js";
import type { ConversationService } from "../services/conversationService.js";

const MessageSchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  text: z.string().min(1)
});

const FakePaymentSchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  planId: z.enum(["companion_plus", "daily_companion", "deep_check"]),
  source: z.string().min(1).default("simulator")
});

const FakePaymentAbandonSchema = FakePaymentSchema.extend({
  reason: z.enum(["not_now", "price_unclear", "too_expensive", "need_to_think", "other"])
});

const ImageSchema = z.object({
  userId: z.string().min(1).default("demo-user"),
  messageId: z.string().min(1).default("simulated-image"),
  source: z.string().min(1).default("simulator")
});

const PushSchema = z.object({
  userId: z.string().min(1).default("demo-user")
});

const DueCheckInQuerySchema = z.object({
  now: z.string().datetime().optional()
});

const RunSchedulerSchema = z.object({
  now: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export function createSimulatorRouter(service: ConversationService, scheduler: CheckInScheduler): Router {
  const router = Router();

  router.get("/messages/:userId", (request, response) => {
    response.json({
      messages: service.listMessages(request.params.userId)
    });
  });

  router.get("/events/:userId", (request, response) => {
    response.json({
      events: service.listEvents(request.params.userId)
    });
  });

  router.get("/metrics", (_request, response) => {
    response.json(service.getMetrics());
  });

  router.post("/message", (request, response) => {
    const input = MessageSchema.parse(request.body);
    const replies = service.handleInboundMessage(input);
    response.json({
      replies,
      messages: service.listMessages(input.userId)
    });
  });

  router.post("/fake-payment", (request, response) => {
    const input = FakePaymentSchema.parse(request.body);
    const reply = service.recordFakePaymentIntent({
      userId: input.userId,
      planId: input.planId as FakePaymentPlanId,
      source: input.source
    });
    response.json({
      replies: [reply],
      messages: service.listMessages(input.userId)
    });
  });

  router.post("/fake-payment-view", (request, response) => {
    const input = FakePaymentSchema.parse(request.body);
    const offer = service.recordFakePaymentView({
      userId: input.userId,
      planId: input.planId as FakePaymentPlanId,
      source: input.source
    });
    response.json({
      offer,
      events: service.listEvents(input.userId)
    });
  });

  router.post("/fake-payment-abandon", (request, response) => {
    const input = FakePaymentAbandonSchema.parse(request.body);
    service.recordFakePaymentAbandon({
      userId: input.userId,
      planId: input.planId as FakePaymentPlanId,
      reason: input.reason,
      source: input.source
    });
    response.json({
      ok: true,
      events: service.listEvents(input.userId)
    });
  });

  router.post("/image", (request, response) => {
    const input = ImageSchema.parse(request.body);
    const replies = service.handleInboundImage(input);
    response.json({
      replies,
      messages: service.listMessages(input.userId)
    });
  });

  router.post("/push", (request, response) => {
    const input = PushSchema.parse(request.body);
    const reply = service.sendProactiveCheckIn(input.userId);
    response.json({
      replies: [reply],
      messages: service.listMessages(input.userId)
    });
  });

  router.get("/due-check-ins", (request, response) => {
    const input = DueCheckInQuerySchema.parse(request.query);
    const now = input.now ? new Date(input.now) : new Date();
    response.json({
      dueUsers: scheduler.listDueUsers(now).map((user) => ({
        id: user.id,
        cadence: user.cadence,
        experimentGroup: user.experimentGroup
      }))
    });
  });

  router.post("/run-scheduler", (request, response) => {
    const input = RunSchedulerSchema.parse(request.body);
    const now = input.now ? new Date(input.now) : new Date();
    const sent = scheduler.sendDueCheckIns(now, input.limit);
    response.json({ sent });
  });

  return router;
}
