/**
 * backend-api/src/consumers/processedEventsConsumer.js
 * Consume processed_events + manual_review → update PostgreSQL
 */
const { Kafka } = require("kafkajs");
const config      = require("../config");
const { createLogger }  = require("../utils/logger");
const eventTracker = require("../services/eventTracker");
const db           = require("../db");

const logger   = createLogger("processed-events-consumer");
const kafka    = new Kafka({ clientId: `${config.kafka.clientId}-processed`, brokers: config.kafka.brokers });
const consumer = kafka.consumer({ groupId: config.kafka.groupIdProcessed });

async function handleProcessedEvent(data) {
  await eventTracker.upsertEvent({
    eventId:     data.eventId,
    commentId:   data.commentId,
    postId:      data.postId,
    pageId:      data.pageId,
    userId:      data.userId,
    userName:    data.userName,
    message:     data.message,
    status:      data.status,
    intent:      data.intent,
    sentiment:   data.sentiment,
    actionTaken: data.actionTaken,
    error:       data.error,
  });
  logger.info(`[PROCESSED_EVENT] sender: ${data.userName || "Unknown"} (${data.userId || "N/A"}) | msg: "${data.message || ""}" | status: ${data.status} | intent: ${data.intent || "none"} | sentiment: ${data.sentiment || "none"}`);
}

async function handleManualReview(data) {
  await db.query(
    `INSERT INTO manual_review_queue (event_id, comment_id, user_id, message, reason, status, created_at)
     VALUES ($1,$2,$3,$4,$5,'pending',NOW()) ON CONFLICT DO NOTHING`,
    [data.eventId, data.commentId, data.userId, data.message, data.reason],
  );
  logger.info(`[MANUAL_REVIEW] inserted eventId=${data.eventId}`);
}

async function start() {
  await consumer.connect();
  await consumer.subscribe({
    topics:        [config.kafka.topics.processedEvents, config.kafka.topics.manualReview],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        if (topic === config.kafka.topics.processedEvents) {
          await handleProcessedEvent(data);
        } else if (topic === config.kafka.topics.manualReview) {
          await handleManualReview(data);
        }
      } catch (err) {
        logger.error(`Error in processedEventsConsumer: ${err.message}`);
      }
    },
  });

  logger.info("processedEventsConsumer started");
}

async function stop() { await consumer.disconnect(); }

module.exports = { start, stop };
