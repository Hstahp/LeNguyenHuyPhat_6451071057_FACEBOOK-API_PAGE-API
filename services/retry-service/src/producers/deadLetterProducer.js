/**
 * retry-service/src/producers/deadLetterProducer.js
 * Theo tài liệu:
 *   - send_retry: Retry Service publish để Backend thử lại gọi Facebook
 *   - dead_letter: Khi vượt quá MAX_RETRIES
 */
const { Kafka } = require("kafkajs");
const config = require("../config");
const { createLogger } = require("../utils/logger");

const logger   = createLogger("retry-producer");
const kafka    = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
const producer = kafka.producer();
let connected  = false;

async function ensureConnected() {
  if (!connected) { await producer.connect(); connected = true; }
}

/**
 * Publish send_retry → Backend API sẽ consume và thử lại gọi Facebook
 */
async function publishSendRetry(sendFailedMsg) {
  await ensureConnected();
  const retryMsg = {
    schema_version: 1,
    command_id:     sendFailedMsg.command_id,
    event_id:       sendFailedMsg.event_id,
    retry_count:    sendFailedMsg.retry_count,
    last_error:     sendFailedMsg.last_error,
    payload:        sendFailedMsg.payload,    // original command để Backend API thực thi lại
    retried_at:     new Date().toISOString(),
  };
  await producer.send({
    topic:    config.kafka.topics.sendRetry,
    messages: [{ key: retryMsg.command_id, value: JSON.stringify(retryMsg) }],
  });
  logger.info(`[SEND_RETRY] command_id=${retryMsg.command_id} attempt=${retryMsg.retry_count}`);
}

/**
 * Publish dead_letter khi đã hết số lần retry
 */
async function publishToDeadLetter(sendFailedMsg, reason) {
  await ensureConnected();
  const dlMsg = {
    schema_version:    1,
    command_id:        sendFailedMsg.command_id,
    event_id:          sendFailedMsg.event_id,
    retry_count:       sendFailedMsg.retry_count,
    last_error:        sendFailedMsg.last_error,
    dead_letter_reason: reason,
    payload:           sendFailedMsg.payload,
    dead_lettered_at:  new Date().toISOString(),
  };
  await producer.send({
    topic:    config.kafka.topics.deadLetter,
    messages: [{ key: dlMsg.command_id, value: JSON.stringify(dlMsg) }],
  });
  logger.error(`[DEAD_LETTER] command_id=${dlMsg.command_id} reason=${reason}`);
}

async function disconnect() {
  if (connected) { await producer.disconnect(); connected = false; }
}

module.exports = { publishSendRetry, publishToDeadLetter, disconnect };
