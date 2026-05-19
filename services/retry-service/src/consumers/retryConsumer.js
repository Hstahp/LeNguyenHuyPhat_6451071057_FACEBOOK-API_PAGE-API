/**
 * retry-service/src/consumers/retryConsumer.js
 * Consume topic send_failed (không phải retry_events)
 */
const { Kafka } = require("kafkajs");
const config       = require("../config");
const { createLogger } = require("../utils/logger");
const retryHandler = require("../services/retryHandler");

const logger   = createLogger("retry-consumer");
const kafka    = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
const consumer = kafka.consumer({ groupId: config.kafka.groupId });

async function start() {
  await consumer.connect();
  // Consume topic send_failed theo tài liệu
  await consumer.subscribe({ topic: config.kafka.topics.sendFailed, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const sendFailedMsg = JSON.parse(message.value.toString());
        await retryHandler.handle(sendFailedMsg);
      } catch (err) {
        logger.error(`Failed to handle send_failed message: ${err.message}`);
      }
    },
  });

  logger.info(`Subscribed to topic: ${config.kafka.topics.sendFailed}`);
}

async function stop() {
  await consumer.disconnect();
}

module.exports = { start, stop };
