/**
 * backend-api/src/config/index.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

module.exports = {
  port: parseInt(process.env.BACKEND_API_PORT, 10) || 3000,

  facebook: {
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
    pageId:          process.env.PAGE_ID,
    graphVersion:    process.env.GRAPH_API_VERSION || "v20.0",
    get baseUrl() {
      return `https://graph.facebook.com/${this.graphVersion}`;
    },
  },

  kafka: {
    brokers:          (process.env.KAFKA_BROKERS || "localhost:9092").split(",").map(s => s.trim()),
    clientId:         process.env.KAFKA_CLIENT_ID        || "backend-api",
    groupIdReply:     process.env.KAFKA_GROUP_ID_REPLY   || "backend-api-reply-group",
    groupIdProcessed: process.env.KAFKA_GROUP_ID_PROCESSED || "backend-api-processed-group",
    groupIdSendRetry: process.env.KAFKA_GROUP_ID_SEND_RETRY || "backend-api-sendretry-group",
    topics: {
      replyCommands:   process.env.KAFKA_TOPIC_REPLY_COMMANDS   || "reply_commands",
      processedEvents: process.env.KAFKA_TOPIC_PROCESSED_EVENTS || "processed_events",
      manualReview:    process.env.KAFKA_TOPIC_MANUAL_REVIEW    || "manual_review",
      // Retry flow theo tài liệu: send_failed và send_retry
      sendFailed:      process.env.KAFKA_TOPIC_SEND_FAILED      || "send_failed",
      sendRetry:       process.env.KAFKA_TOPIC_SEND_RETRY       || "send_retry",
      deadLetter:      process.env.KAFKA_TOPIC_DEAD_LETTER      || "dead_letter",
    },
  },

  postgres: {
    host:     process.env.POSTGRES_HOST     || "localhost",
    port:     parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    database: process.env.POSTGRES_DB       || "fb_api_db",
    user:     process.env.POSTGRES_USER     || "fb_api_user",
    password: process.env.POSTGRES_PASSWORD || "fb_api_password",
  },

  circuitBreaker: {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD, 10) || 10,
    recoveryTimeMs:   parseInt(process.env.CB_RECOVERY_TIME_MS,  10) || 30_000,
  },
};
