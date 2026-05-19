/**
 * retry-service/src/services/retryHandler.js
 * Theo tài liệu:
 *   - Consume send_failed
 *   - Exponential backoff: delay = initialBackoffMs * 2^retry_count
 *     (lần 1: 1s, lần 2: 2s, lần 3: 4s, lần 4: 8s, lần 5: 16s)
 *   - retry_count < MAX_RETRIES → publish send_retry
 *   - retry_count >= MAX_RETRIES → publish dead_letter
 */
const config   = require("../config");
const producer = require("../producers/deadLetterProducer");
const { createLogger } = require("../utils/logger");

const logger = createLogger("retry-handler");

function calcDelay(retryCount) {
  // Lần 1: 1s, lần 2: 2s, lần 3: 4s... (2^(retryCount-1) * initialBackoffMs)
  return config.retry.initialBackoffMs * Math.pow(2, retryCount - 1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {object} sendFailedMsg - message từ topic send_failed
 * {
 *   schema_version, command_id, event_id,
 *   retry_count, last_error, payload, failed_at
 * }
 */
async function handle(sendFailedMsg) {
  const retryCount  = sendFailedMsg.retry_count  || 1;
  const maxRetries  = config.retry.maxRetries;
  const commandId   = sendFailedMsg.command_id;

  logger.info(`[RETRY] attempt=${retryCount}/${maxRetries} command_id=${commandId} last_error=${sendFailedMsg.last_error}`);

  // Đã vượt ngưỡng → chuyển sang dead_letter
  if (retryCount > maxRetries) {
    logger.error(`[DEAD_LETTER] command_id=${commandId} max retries (${maxRetries}) exceeded`);
    await producer.publishToDeadLetter(
      sendFailedMsg,
      `Max retries (${maxRetries}) exceeded. Last error: ${sendFailedMsg.last_error}`,
    );
    return;
  }

  // Exponential backoff
  const delayMs = calcDelay(retryCount);
  logger.info(`[BACKOFF] waiting ${delayMs}ms (attempt ${retryCount}) before re-queuing command_id=${commandId}`);
  await sleep(delayMs);

  // Publish send_retry → Backend API sẽ thử lại gọi Facebook
  await producer.publishSendRetry(sendFailedMsg);
}

module.exports = { handle };
