/**
 * backend-api/src/services/facebookApiService.js
 * *** DỊCH VỤ DUY NHẤT được phép gọi Facebook Graph API ***
 * Giao tiếp nội bộ: nhận lệnh từ reply_commands qua Kafka, không nhận HTTP trực tiếp
 */
const axios  = require("axios");
const config = require("../config");
const CircuitBreaker = require("../utils/circuitBreaker");
const { createLogger } = require("../utils/logger");

const logger = createLogger("facebook-api-service");

const cb = new CircuitBreaker({
  failureThreshold: config.circuitBreaker.failureThreshold,
  recoveryTimeMs:   config.circuitBreaker.recoveryTimeMs,
  name:             "FacebookAPI",
});

const fbAxios = axios.create({
  baseURL: config.facebook.baseUrl,
  timeout: 10_000,
});

// ── Action Handlers ────────────────────────────────────────────────────────────

async function hideComment(commentId) {
  return cb.execute(async () => {
    const resp = await fbAxios.post(`/${commentId}`, { is_hidden: true }, {
      params: { access_token: config.facebook.pageAccessToken },
    });
    logger.info(`[HIDE_COMMENT] commentId=${commentId} ok`);
    return resp.data;
  });
}

async function sendReply(commentId, message) {
  return cb.execute(async () => {
    const resp = await fbAxios.post(`/${commentId}/comments`, { message }, {
      params: { access_token: config.facebook.pageAccessToken },
    });
    logger.info(`[SEND_REPLY] commentId=${commentId} message="${message.slice(0, 40)}..."`);
    return resp.data;
  });
}

async function blockUser(userId) {
  // Block user from commenting on the Page
  return cb.execute(async () => {
    const resp = await fbAxios.post(`/${config.facebook.pageId}/blocked`, null, {
      params: { user: userId, access_token: config.facebook.pageAccessToken },
    });
    logger.info(`[BLOCK_USER] userId=${userId} ok`);
    return resp.data;
  });
}

// ── Dispatcher: routes action → correct handler ────────────────────────────────

async function executeCommand(command) {
  // Normalize field names — tài liệu dùng reply_text, code cũ dùng replyMessage
  const commentId  = command.comment_id  || command.commentId || (command.target && command.target.comment_id);
  const userId     = command.user_id     || command.userId;
  const replyText  = command.reply_text  || command.replyMessage;
  const { action } = command;

  switch (action) {
    case "hide_comment":
      return hideComment(commentId);

    // Tài liệu dùng action "reply", code cũ dùng "send_reply" — hỗ trợ cả hai
    case "reply":
    case "send_reply":
      return sendReply(commentId, replyText || "Cảm ơn bạn đã liên hệ!");

    case "blacklist_user":
      // Blacklist lưu trong DB (thực hiện tại replyCommandsConsumer)
      logger.info(`[BLACKLIST] user_id=${userId} — stored in DB`);
      return { skipped: true, reason: "stored_in_db" };

    case "manual_review":
      // Manual review lưu trong DB (thực hiện tại replyCommandsConsumer)
      logger.info(`[MANUAL_REVIEW] stored in DB for admin review`);
      return { skipped: true, reason: "queued_for_review" };

    default:
      logger.warn(`Unknown action: ${action}`);
      return { skipped: true, reason: `unknown_action: ${action}` };
  }
}

function getCircuitBreakerState() {
  return { state: cb.getState(), failures: cb.getFailureCount() };
}

module.exports = { executeCommand, getCircuitBreakerState };
