/**
 * core-service/src/config/index.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

module.exports = {
  port: parseInt(process.env.CORE_SERVICE_PORT, 10) || 3002,

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
      .split(",").map(s => s.trim()).filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID || "core-service",
    groupId:  process.env.KAFKA_GROUP_ID  || "core-service-group",
    topics: {
      rawEvents:       process.env.KAFKA_TOPIC_RAW_EVENTS       || "raw_events",
      processedEvents: process.env.KAFKA_TOPIC_PROCESSED_EVENTS || "processed_events",
      replyCommands:   process.env.KAFKA_TOPIC_REPLY_COMMANDS   || "reply_commands",
      manualReview:    process.env.KAFKA_TOPIC_MANUAL_REVIEW    || "manual_review",
    },
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model:  process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  },

  rateLimit: {
    windowMs:    parseInt(process.env.RATE_LIMIT_WINDOW_MS,    10) || 60_000,
    maxComments: parseInt(process.env.RATE_LIMIT_MAX_COMMENTS, 10) || 20,
  },

  circuitBreaker: {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD,  10) || 10,
    recoveryTimeMs:   parseInt(process.env.CB_RECOVERY_TIME_MS,   10) || 30_000,
  },
};
