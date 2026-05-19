/**
 * core-service/src/producers/commandsProducer.js
 * Publish messages sang reply_commands, processed_events, manual_review
 */
const { Kafka } = require("kafkajs");
const config = require("../config");
const { createLogger } = require("../utils/logger");

const logger   = createLogger("commands-producer");
const kafka    = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
const producer = kafka.producer();

let connected = false;

async function ensureConnected() {
  if (!connected) {
    await producer.connect();
    connected = true;
    logger.info("Kafka producer connected");
  }
}

async function publishReplyCommand(command) {
  await ensureConnected();
  await producer.send({
    topic: config.kafka.topics.replyCommands,
    messages: [{
      key:   command.userId || command.pageId || "core",
      value: JSON.stringify(command),
    }],
  });
  if (command.action === "blacklist_user") {
    logger.warn(`🛑 [BLACKLIST_COMMAND] Published blacklist command for userId=${command.userId} reason="${command.reason}"`);
  } else {
    logger.info(`[reply_commands] action=${command.action} commentId=${command.commentId}`);
  }
}

async function publishProcessedEvent(event) {
  await ensureConnected();
  await producer.send({
    topic: config.kafka.topics.processedEvents,
    messages: [{
      key:   event.commentId || event.eventId || "core",
      value: JSON.stringify(event),
    }],
  });
  logger.info(`[processed_events] status=${event.status} sender=${event.userName || event.userId || "Unknown"} | msg="${event.message || ""}" | intent=${event.intent || "none"} | sentiment=${event.sentiment || "none"}`);
}

async function publishManualReview(item) {
  await ensureConnected();
  await producer.send({
    topic: config.kafka.topics.manualReview,
    messages: [{
      key:   item.userId || "core",
      value: JSON.stringify(item),
    }],
  });
  logger.info(`[manual_review] published for userId=${item.userId}`);
}

async function disconnect() {
  if (connected) { await producer.disconnect(); connected = false; }
}

module.exports = { publishReplyCommand, publishProcessedEvent, publishManualReview, disconnect };
