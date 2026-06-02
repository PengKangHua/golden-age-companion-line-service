import { Client, validateSignature, type WebhookEvent } from "@line/bot-sdk";
import express, { Router } from "express";
import type { AppConfig } from "../config.js";
import type { ConversationService } from "../services/conversationService.js";

export function createLineWebhookRouter(service: ConversationService, config: AppConfig): Router {
  const router = Router();
  const lineClient = config.lineChannelAccessToken
    ? new Client({ channelAccessToken: config.lineChannelAccessToken })
    : undefined;

  router.post("/webhook", express.raw({ type: "*/*" }), async (request, response, next) => {
    try {
      const body = request.body.toString("utf8");
      if (config.lineChannelSecret) {
        const signature = request.header("x-line-signature");
        if (!signature || !validateSignature(body, config.lineChannelSecret, signature)) {
          response.status(401).json({ ok: false, error: "invalid LINE signature" });
          return;
        }
      }

      const payload = JSON.parse(body) as { events?: WebhookEvent[] };
      const events = payload.events ?? [];
      const results = await Promise.all(events.map((event) => handleLineEvent(event, service, lineClient)));

      response.json({ ok: true, results });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function handleLineEvent(
  event: WebhookEvent,
  service: ConversationService,
  lineClient: Client | undefined
): Promise<{ eventType: string; replies: number }> {
  if (event.type !== "message" || !event.source.userId) {
    return { eventType: event.type, replies: 0 };
  }

  const replies =
    event.message.type === "text"
      ? service.handleInboundMessage({
          userId: event.source.userId,
          text: event.message.text
        })
      : event.message.type === "image"
        ? service.handleInboundImage({
            userId: event.source.userId,
            messageId: event.message.id,
            source: "line"
          })
        : [];

  if (lineClient && event.replyToken) {
    await lineClient.replyMessage(
      event.replyToken,
      replies.map((text) => ({ type: "text", text }))
    );
  }

  return { eventType: event.type, replies: replies.length };
}
