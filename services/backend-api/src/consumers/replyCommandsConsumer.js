/**
 * backend-api/src/consumers/replyCommandsConsumer.js
 * Consume reply_commands và send_retry → call Facebook API
 * Thất bại → publish send_failed (Retry Service xử lý)
 *
 * Luồng theo tài liệu:
 *   reply_commands → Backend API → FB API OK → done
 *                               → FB API FAIL → send_failed
 *   send_failed → Retry Service (backoff) → send_retry
 *   send_retry  → Backend API → thử lại FB API
 */
const { Kafka } = require("kafkajs");
const config       = require("../config");
const { createLogger }    = require("../utils/logger");
const fbApi        = require("../services/facebookApiService");
const blacklistSvc = require("../services/blacklistService");
const db           = require("../db");

const logger   = createLogger("reply-commands-consumer");
const kafka    = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
const consumer = kafka.consumer({ groupId: config.kafka.groupIdReply });

// Kafka producer dùng để publish send_failed
const producer = kafka.producer();
let producerConnected = false;

async function ensureProducer() {
  if (!producerConnected) { await producer.connect(); producerConnected = true; }
}

/**
 * Publish send_failed khi Backend API gọi Facebook thất bại
 * Retry Service sẽ consume topic này và apply exponential backoff
 */
async function publishSendFailed(command, error) {
  await ensureProducer();
  const failedMsg = {
    schema_version: 1,
    command_id:     command.command_id || command.commandId,
    event_id:       command.event_id   || command.originalEventId,
    retry_count:    (command.retry_count || command.retryCount || 0) + 1,
    last_error:     error.message,
    payload:        command,               // gữ toàn bộ command gốc để retry
    failed_at:      new Date().toISOString(),
  };
  await producer.send({
    topic:    config.kafka.topics.sendFailed,
    messages: [{ key: failedMsg.command_id, value: JSON.stringify(failedMsg) }],
  });
  logger.warn(`[SEND_FAILED] command_id=${failedMsg.command_id} retry_count=${failedMsg.retry_count}`);
}

/**
 * Log command execution vào DB (idempotency + tracking)
 */
async function logCommand(commandId, action, status, retryCount, errorMsg) {
  await db.query(
    `INSERT INTO command_log (command_id, action, status, retry_count, error_msg, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (command_id) DO UPDATE SET
       status=$3, retry_count=$4, error_msg=$5,
       completed_at=CASE WHEN $3='success' THEN NOW() ELSE NULL END`,
    [commandId, action, status, retryCount || 0, errorMsg || null],
  );
}

/**
 * Xử lý một command — cả từ reply_commands lẫn send_retry
 */
async function processCommand(command) {
  // Normalize field names — hỗ trợ cả camelCase (cũ) và snake_case (tài liệu)
  const commandId  = command.command_id  || command.commandId;
  const action     = command.action;
  const commentId  = command.comment_id  || command.commentId;
  const userId     = command.user_id     || command.userId;
  const pageId     = command.page_id     || command.pageId;
  const eventId    = command.event_id    || command.originalEventId;
  const replyText  = command.reply_text  || command.replyMessage;
  const retryCount = command.retry_count || command.retryCount || 0;

  logger.info(`[COMMAND] id=${commandId} action=${action} comment_id=${commentId} retry=${retryCount}`);

  // ── Idempotency: bỏ qua nếu đã xử lý thành công ─────────────────────────
  const existing = await db.query(
    "SELECT status FROM command_log WHERE command_id=$1", [commandId],
  );
  if (existing.rows[0]?.status === "success") {
    logger.warn(`[IDEMPOTENT] command_id=${commandId} already succeeded — skip`);
    return;
  }

  // ── Kiểm tra blacklist trước khi reply ──────────────────────────────────
  if (action === "send_reply" || action === "reply") {
    if (userId && await blacklistSvc.isBlacklisted(userId)) {
      logger.warn(`[BLACKLISTED] skip reply for user_id=${userId}`);
      await logCommand(commandId, action, "skipped_blacklisted", retryCount, null);
      return;
    }
  }

  // ── Lưu blacklist vào DB ─────────────────────────────────────────────────
  if (action === "blacklist_user") {
    await blacklistSvc.add(userId, pageId, command.reason);
    await logCommand(commandId, action, "success", retryCount, null);
    logger.info(`[BLACKLIST] user_id=${userId} added`);
    return;
  }

  // ── Lưu manual review vào DB ────────────────────────────────────────────
  if (action === "manual_review") {
    await db.query(
      `INSERT INTO manual_review_queue
         (event_id, comment_id, user_id, message, reason, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending',NOW())
       ON CONFLICT DO NOTHING`,
      [eventId, commentId, userId, command.message, command.reason],
    );
    await logCommand(commandId, action, "success", retryCount, null);
    logger.info(`[MANUAL_REVIEW] queued event_id=${eventId}`);
    return;
  }

  // ── Gọi Facebook Graph API (chỉ service này được phép) ─────────────────
  try {
    // Normalize command cho facebookApiService
    const normalizedCmd = {
      ...command,
      action,
      commentId: commentId,
      userId:    userId,
      replyMessage: replyText,    // facebookApiService dùng replyMessage
    };
    await fbApi.executeCommand(normalizedCmd);
    await logCommand(commandId, action, "success", retryCount, null);
    logger.info(`[SUCCESS] command_id=${commandId} action=${action}`);
  } catch (err) {
    logger.error(`[FAILED] command_id=${commandId} error=${err.message}`);
    await logCommand(commandId, action, "failed", retryCount, err.message);
    // Publish send_failed → Retry Service sẽ xử lý
    await publishSendFailed(command, err);
  }
}

// ── Start consumers ──────────────────────────────────────────────────────────
async function start() {
  await consumer.connect();

  // Consumer nhận cả reply_commands (lần đầu) và send_retry (từ retry-service)
  await consumer.subscribe({
    topics:        [config.kafka.topics.replyCommands, config.kafka.topics.sendRetry],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        let command = JSON.parse(message.value.toString());
        // Nếu đến từ send_retry, payload gốc nằm trong field 'payload'
        if (topic === config.kafka.topics.sendRetry && command.payload) {
          command = {
            ...command.payload,
            retry_count: command.retry_count,
          };
        }
        await processCommand(command);
      } catch (err) {
        logger.error(`Failed to process command from ${topic}: ${err.message}`);
      }
    },
  });

  logger.info(`Subscribed to: ${config.kafka.topics.replyCommands}, ${config.kafka.topics.sendRetry}`);
}

async function stop() {
  await consumer.disconnect();
  if (producerConnected) await producer.disconnect();
}

module.exports = { start, stop };
