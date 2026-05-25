/**
 * core-service/src/consumers/rawEventsConsumer.js
 * Pipeline: idempotency → rate-limit → spam detection → AI analysis → action
 */
const { Kafka } = require("kafkajs");
const config        = require("../config");
const { createLogger } = require("../utils/logger");
const spamDetector  = require("../services/spamDetector");
const aiAnalyzer    = require("../services/aiAnalyzer");
const actionDecider = require("../services/actionDecider");
const rateLimiter   = require("../services/rateLimiter");
const idempotency   = require("../utils/idempotency");
const producer      = require("../producers/commandsProducer");

const logger   = createLogger("raw-events-consumer");
const kafka    = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
const consumer = kafka.consumer({ groupId: config.kafka.groupId });

// ── Spam repeat-offense tracker: senderId → count (last 24h) ─────────────────
const spamCounts = new Map();
function incrementSpamCount(userId) {
  const count = (spamCounts.get(userId) || 0) + 1;
  spamCounts.set(userId, count);
  return count;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
async function processEvent(event) {
  // Build stable idempotency key
  const idempKey = event.commentId
    || `${event.senderId}_${event.eventType}_${event.eventTime}`;

  // 1. Idempotency — skip duplicates
  if (idempotency.has(idempKey)) {
    logger.warn(`[IDEMPOTENT] skip duplicate: ${idempKey}`);
    return;
  }
  idempotency.add(idempKey);

  logger.info(`Processing event=${idempKey} type=${event.eventType}`);

  // 2. Rate limiting
  const rl = rateLimiter.check(event.senderId);
  if (rl.limited) {
    logger.warn(`[RATE_LIMIT] userId=${event.senderId} count=${rl.count}`);
    await producer.publishProcessedEvent({
      eventId: idempKey, commentId: event.commentId, postId: event.postId,
      pageId: event.pageId, userId: event.senderId, userName: event.senderName,
      message: event.message,
      status: "pending_review", reason: "rate_limit_exceeded",
      processedAt: new Date().toISOString(),
    });
    return;
  }

  // 3. Only process comment_created with message body
  if (event.eventType !== "comment_created" || !event.message) {
    logger.debug(`Skipping event type=${event.eventType}`);
    return;
  }

  // Prevent infinite reply loops (Page replying to its own comment)
  if (event.senderId && event.pageId && String(event.senderId) === String(event.pageId)) {
    logger.info(`[SKIP] Comment is from the Page itself (${event.pageId}) — ignoring to prevent loop`);
    return;
  }

  // 4. Spam detection
  const spam = spamDetector.detect(event);
  if (spam.isSpam) {
    logger.warn(`[SPAM] type=${spam.type} severity=${spam.severity} user=${event.senderId}`);

    const spamCount = incrementSpamCount(event.senderId);
    if (spamCount >= 3) {
      logger.warn(`🚨 [BLACKLIST_ALERT] User ${event.senderName || event.senderId} has spammed ${spamCount} times in 24h! Triggering internal blacklist.`);
    }
    const commands  = actionDecider.decideSpamAction(event, { ...spam, repeatCount: spamCount });

    for (const cmd of commands) {
      if (cmd.action === "manual_review") {
        await producer.publishManualReview({
          eventId: idempKey, commentId: event.commentId,
          userId: event.senderId, message: event.message,
          reason: cmd.reason, createdAt: cmd.createdAt,
        });
      } else {
        await producer.publishReplyCommand(cmd);
      }
    }

    await producer.publishProcessedEvent({
      eventId: idempKey, commentId: event.commentId, postId: event.postId,
      pageId: event.pageId, userId: event.senderId, userName: event.senderName,
      message: event.message,
      status: "spam_detected", spamType: spam.type,
      actionTaken: commands.map(c => c.action).join(","),
      processedAt: new Date().toISOString(),
    });
    return;
  }

  // 5. AI analysis via Groq
  try {
    const ai = await aiAnalyzer.analyze(event.message);
    logger.info(`[AI] intent=${ai.intent} sentiment=${ai.sentiment} conf=${ai.confidence}`);

    const commands = actionDecider.decideAiAction(event, ai);
    for (const cmd of commands) {
      if (cmd.action === "manual_review") {
        await producer.publishManualReview({
          eventId: idempKey, commentId: event.commentId,
          userId: event.senderId, message: event.message,
          reason: cmd.reason, createdAt: cmd.createdAt,
        });
      } else {
        await producer.publishReplyCommand(cmd);
      }
    }

    await producer.publishProcessedEvent({
      eventId: idempKey, commentId: event.commentId, postId: event.postId,
      pageId: event.pageId, userId: event.senderId, userName: event.senderName,
      message: event.message,
      status: "processed", intent: ai.intent, sentiment: ai.sentiment,
      actionTaken: commands.map(c => c.action).join(",") || "none",
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[AI_ERROR] ${err.message}`);
    await producer.publishProcessedEvent({
      eventId: idempKey, commentId: event.commentId, postId: event.postId,
      pageId: event.pageId, userId: event.senderId, userName: event.senderName,
      message: event.message,
      status: "failed", error: err.message,
      processedAt: new Date().toISOString(),
    });
  }
}

// ── Start consumer ────────────────────────────────────────────────────────────
async function start() {
  await consumer.connect();
  logger.info("Consumer connected");

  await consumer.subscribe({ topic: config.kafka.topics.rawEvents, fromBeginning: false });

  await consumer.run({
    partitionsConsumedConcurrently: 2,
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        await processEvent(event);
      } catch (err) {
        logger.error(`Failed to handle message: ${err.message}`);
      }
    },
  });

  logger.info(`Subscribed to topic: ${config.kafka.topics.rawEvents}`);
}

async function stop() {
  await consumer.disconnect();
  await producer.disconnect();
}

module.exports = { start, stop };
