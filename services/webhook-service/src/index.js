/**
 * services/webhook-service/src/index.js
 * File chạy chính của webhook-service — Port 3001
 * Nhận webhook từ Facebook, normalize, publish lên Kafka
 */
const express = require("express");
const crypto  = require("crypto");
const morgan  = require("morgan");
const { Kafka } = require("kafkajs");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });


const config = require("./config");
const { createLogger } = require("./utils/logger");

const logger = createLogger("webhook-service");
const app    = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = Buffer.from(buf); }
}));
app.use(morgan("dev"));

// ─── Kafka Producer ───────────────────────────────────────────────────────────
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers:  config.kafka.brokers,
});

let kafkaProducer = null;
let kafkaConnectPromise = null;

async function getKafkaProducer() {
  if (kafkaProducer) return kafkaProducer;
  if (!kafkaConnectPromise) {
    const producer = kafka.producer();
    kafkaConnectPromise = producer.connect()
      .then(() => { kafkaProducer = producer; return kafkaProducer; })
      .catch((err) => { kafkaConnectPromise = null; throw err; });
  }
  return kafkaConnectPromise;
}

async function publishRawEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  const producer = await getKafkaProducer();
  await producer.send({
    topic: config.kafka.topics.rawEvents,
    messages: events.map((event) => ({
      key:   event.pageId || event.senderId || "facebook",
      value: JSON.stringify(event),
    })),
  });
}

// ─── Signature Verification ───────────────────────────────────────────────────
function verifyFacebookSignature(req) {
  const signatureHeader = req.get("x-hub-signature-256");
  if (!config.facebook.appSecret)
    return { ok: false, reason: "FACEBOOK_APP_SECRET is not configured" };
  if (!signatureHeader)
    return { ok: false, reason: "Missing x-hub-signature-256 header" };

  const [algorithm, receivedSignature] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !receivedSignature)
    return { ok: false, reason: "Invalid signature header format" };

  const expectedSignature = crypto
    .createHmac("sha256", config.facebook.appSecret)
    .update(req.rawBody || Buffer.from(""))
    .digest("hex");

  const receivedBuffer = Buffer.from(receivedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (receivedBuffer.length !== expectedBuffer.length)
    return { ok: false, reason: "Signature length mismatch" };

  const isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  return { ok: isValid, reason: isValid ? null : "Signature verification failed" };
}

// ─── Event Normalization ──────────────────────────────────────────────────────
function normalizeTimestamp(value) {
  if (typeof value === "number") {
    const unixMs = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(unixMs).toISOString();
  }
  return new Date().toISOString();
}

function buildChangeEventType(changeField, item) {
  if (changeField === "feed" && item === "comment")                     return "comment_created";
  if (changeField === "feed" && (item === "post" || item === "status")) return "post_created";
  if (changeField === "messages")                                        return "message_created";
  return changeField ? `${changeField}_updated` : "page_change";
}

function normalizeWebhookEvents(payload) {
  if (payload?.object !== "page" || !Array.isArray(payload?.entry)) return [];
  const events = [];

  for (const entry of payload.entry) {
    const pageId    = entry?.id ? String(entry.id) : null;

    if (Array.isArray(entry?.messaging)) {
      for (const item of entry.messaging) {
        events.push({
          source: "facebook", schemaVersion: "1.0.0",
          eventType:   item?.message ? "message_received" : "messaging_event",
          pageId,
          senderId:    item?.sender?.id    || null,
          recipientId: item?.recipient?.id || null,
          message:     item?.message?.text || null,
          item:        "message", field: "messaging",
          eventTime:   normalizeTimestamp(item?.timestamp || entry?.time),
          raw: { entry, messaging: item },
        });
      }
    }

    if (Array.isArray(entry?.changes)) {
      for (const change of entry.changes) {
        const value    = change?.value || {};
        const itemType = value?.item   || null;
        events.push({
          source: "facebook", schemaVersion: "1.0.0",
          eventType:  buildChangeEventType(change?.field, itemType),
          pageId,
          senderId:   value?.from?.id || value?.sender_id || null,
          senderName: value?.from?.name || value?.sender_name || "Facebook User",
          postId:     value?.post_id  || value?.parent_id || "post_default_123",
          commentId:  value?.comment_id || null,
          message:    value?.message   || null,
          item:       itemType, field: change?.field || null,
          eventTime:  normalizeTimestamp(value?.created_time || entry?.time),
          raw: { entry, change },
        });
      }
    }
  }
  return events;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ service: "webhook-service", status: "ok", port: config.port });
});

app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.facebook.verifyToken) {
    return res.status(200).send(String(challenge || ""));
  }
  res.status(403).json({ error: "Webhook verification failed" });
});

app.post("/webhook", async (req, res) => {
  const signatureCheck = verifyFacebookSignature(req);
  if (!signatureCheck.ok) {
    logger.warn(`Signature warning: ${signatureCheck.reason}`);
  }

  const normalizedEvents = normalizeWebhookEvents(req.body);

  try {
    if (normalizedEvents.length > 0) {
      await publishRawEvents(normalizedEvents);
      logger.info(`Published ${normalizedEvents.length} event(s) to Kafka`);
    }
    res.status(200).json({
      status: "EVENT_RECEIVED",
      receivedEvents: normalizedEvents.length,
      publishedTopic: config.kafka.topics.rawEvents,
    });
  } catch (error) {
    logger.error(`Failed to process webhook: ${error.message}`);
    res.status(500).json({ error: "Failed to process webhook events", message: error.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`webhook-service running at http://localhost:${config.port}`);
});
