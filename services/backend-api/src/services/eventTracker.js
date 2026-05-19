/**
 * backend-api/src/services/eventTracker.js
 * CRUD operations on events table
 */
const db = require("../db");
const { createLogger } = require("../utils/logger");

const logger = createLogger("event-tracker");

async function upsertEvent(event) {
  const sql = `
    INSERT INTO comments (comment_id, post_id, page_id, user_id, user_name, message, status, intent, sentiment, action_taken, error_msg, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    ON CONFLICT (comment_id) DO UPDATE SET
      status       = EXCLUDED.status,
      intent       = COALESCE(EXCLUDED.intent,       comments.intent),
      sentiment    = COALESCE(EXCLUDED.sentiment,    comments.sentiment),
      action_taken = COALESCE(EXCLUDED.action_taken, comments.action_taken),
      error_msg    = COALESCE(EXCLUDED.error_msg,    comments.error_msg),
      user_name    = COALESCE(EXCLUDED.user_name,    comments.user_name),
      message      = COALESCE(EXCLUDED.message,      comments.message),
      updated_at   = NOW()
    RETURNING *;
  `;
  const values = [
    event.commentId || event.eventId || `cmd_${Date.now()}`,
    event.postId    || "post_default_123",
    event.pageId    || null,
    event.userId    || event.senderId || null,
    event.userName  || "Facebook User",
    event.message   || null,
    event.status    || "received",
    event.intent    || null,
    event.sentiment || null,
    event.actionTaken || null,
    event.error     || null,
  ];
  const res = await db.query(sql, values);
  return res.rows[0];
}

async function updateStatus(commentId, status, extra = {}) {
  const sql = `
    UPDATE comments SET status=$2, action_taken=COALESCE($3, action_taken),
      error_msg=COALESCE($4, error_msg), updated_at=NOW()
    WHERE comment_id=$1 RETURNING *;
  `;
  const res = await db.query(sql, [commentId, status, extra.actionTaken || null, extra.error || null]);
  return res.rows[0];
}

async function findByStatus(status, limit = 50) {
  const res = await db.query(
    "SELECT * FROM comments WHERE status=$1 ORDER BY created_at DESC LIMIT $2",
    [status, limit],
  );
  return res.rows;
}

async function findAll(limit = 100) {
  const res = await db.query(
    "SELECT * FROM comments ORDER BY created_at DESC LIMIT $1", [limit],
  );
  return res.rows;
}

module.exports = { upsertEvent, updateStatus, findByStatus, findAll };
