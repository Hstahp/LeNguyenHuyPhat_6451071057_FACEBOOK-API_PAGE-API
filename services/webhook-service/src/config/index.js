/**
 * services/webhook-service/src/config/index.js
 * Cấu hình Kafka, Env riêng cho webhook-service
 */
// Load .env từ thư mục gốc của service (độc lập với monorepo)
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });


const config = {
  port: parseInt(process.env.WEBHOOK_SERVICE_PORT, 10) || 3001,

  facebook: {
    verifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
    appSecret:   process.env.FACEBOOK_APP_SECRET,
  },

  kafka: {
    brokers:  (process.env.KAFKA_BROKERS || "localhost:9092")
                .split(",").map((s) => s.trim()).filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID || "facebook-webhook-service",
    topics: {
      rawEvents: process.env.KAFKA_TOPIC_RAW_EVENTS || "raw_events",
    },
  },
};

module.exports = config;
