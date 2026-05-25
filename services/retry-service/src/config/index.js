/**
 * retry-service/src/config/index.js
 * Theo tài liệu: consume send_failed → exponential backoff → publish send_retry
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

module.exports = {
  port: parseInt(process.env.RETRY_SERVICE_PORT, 10) || 3003,
  kafka: {
    brokers:  (process.env.KAFKA_BROKERS || "localhost:9092").split(",").map(s => s.trim()),
    clientId: process.env.KAFKA_CLIENT_ID || "retry-service",
    groupId:  process.env.KAFKA_GROUP_ID  || "retry-service-group",
    topics: {
      // Theo tài liệu: Backend publish send_failed khi gọi FB thất bại
      sendFailed: process.env.KAFKA_TOPIC_SEND_FAILED || "send_failed",
      // Retry Service publish send_retry để Backend thử lại
      sendRetry:  process.env.KAFKA_TOPIC_SEND_RETRY  || "send_retry",
      deadLetter: process.env.KAFKA_TOPIC_DEAD_LETTER || "dead_letter",
    },
  },
  retry: {
    maxRetries:       parseInt(process.env.MAX_RETRIES,        10) || 5,
    initialBackoffMs: parseInt(process.env.INITIAL_BACKOFF_MS, 10) || 1000,
  },
};
