/**
 * core-service/src/services/actionDecider.js
 * Ra quyết định dựa trên spam result hoặc AI result.
 * Publish reply_commands với schema theo đúng tài liệu.
 *
 * Schema reply_commands theo tài liệu:
 * {
 *   schema_version: 1,
 *   command_id: "cmd_001",
 *   event_id: "evt_001",
 *   action: "reply" | "hide_comment" | "blacklist_user" | "manual_review",
 *   target: { page_id, comment_id },
 *   reply_text: "...",      ← field name từ tài liệu
 *   intent: "ask_price",
 *   sentiment: "neutral",
 *   created_at: "ISO8601"
 * }
 */

function makeCommandId() {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildBase(event, extra = {}) {
  return {
    schema_version: 1,
    command_id:     makeCommandId(),
    event_id:       event.commentId || event.event_id || event.eventTime,
    target: {
      page_id:    event.pageId    || event.page_id,
      comment_id: event.commentId || event.comment_id,
    },
    // Backward compat fields
    pageId:    event.pageId,
    commentId: event.commentId,
    postId:    event.postId,
    userId:    event.senderId || event.user_id,
    user_id:   event.senderId || event.user_id,
    retry_count: 0,
    created_at:  new Date().toISOString(),
    ...extra,
  };
}

/**
 * Quyết định action khi phát hiện spam
 * Theo tài liệu:
 *   - Spam nhẹ → ẩn bình luận ngay
 *   - Spam lặp 3 lần/24h → blacklist nội bộ + không auto reply
 *   - Link độc hại/scam/bot rõ → ẩn ngay + manual review
 */
function decideSpamAction(event, spamResult) {
  const commands = [];

  if (spamResult.severity === "malicious") {
    // Link độc hại / scam / bot rõ → ẩn ngay + đẩy manual review
    commands.push(buildBase(event, {
      command_id: makeCommandId(),
      action:     "hide_comment",
      reason:     `Malicious content detected: ${spamResult.type}`,
      sentiment:  "negative",
      intent:     "spam",
    }));
    commands.push(buildBase(event, {
      command_id: makeCommandId(),
      action:     "manual_review",
      reason:     `Admin review required: ${spamResult.type}`,
      sentiment:  "negative",
      intent:     "spam",
    }));

  } else if (spamResult.repeatCount >= 3 || spamResult.severity === "heavy") {
    // Lặp >= 3 lần / 24h → ẩn + blacklist nội bộ
    commands.push(buildBase(event, {
      command_id: makeCommandId(),
      action:     "hide_comment",
      reason:     `Repeated spam (${spamResult.repeatCount}x in 24h): ${spamResult.type}`,
      sentiment:  "negative",
      intent:     "spam",
    }));
    commands.push(buildBase(event, {
      command_id: makeCommandId(),
      action:     "blacklist_user",
      reason:     `Blacklisted after ${spamResult.repeatCount} offenses in 24h`,
      sentiment:  "negative",
      intent:     "spam",
    }));

  } else {
    // Spam nhẹ (external link) → ẩn bình luận ngay
    commands.push(buildBase(event, {
      command_id: makeCommandId(),
      action:     "hide_comment",
      reason:     `Light spam: ${spamResult.type}`,
      sentiment:  "negative",
      intent:     "spam",
    }));
  }

  return commands;
}

/**
 * Quyết định action dựa trên kết quả AI
 * Theo tài liệu:
 *   - Tích cực → cảm ơn người dùng (send reply)
 *   - Tiêu cực → xin lỗi người dùng (send reply) HOẶC manual review nếu complaint
 *   - Hỏi giá/hỏi sản phẩm → hướng dẫn / reply
 */
function decideAiAction(event, aiResult) {
  const commands = [];

  // Complaint + negative → manual review (không tự động reply)
  if (aiResult.intent === "complaint" || aiResult.sentiment === "negative") {
    commands.push(buildBase(event, {
      command_id: makeCommandId(),
      action:     "manual_review",
      reason:     `Negative/complaint detected: intent=${aiResult.intent} sentiment=${aiResult.sentiment}`,
      intent:     aiResult.intent,
      sentiment:  aiResult.sentiment,
    }));
    return commands;
  }

  // Theo yêu cầu 4.2: chỉ cần phân loại và lưu trữ JSON, không tự động gọi API reply lên fanpage.
  // Các comment bình thường (ask_price, praise, neutral) sẽ được ghi nhận vào processed_events.
  return commands;
}

module.exports = { decideSpamAction, decideAiAction };
