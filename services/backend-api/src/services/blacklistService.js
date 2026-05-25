/**
 * backend-api/src/services/blacklistService.js
 */
const db = require("../db");

async function add(userId, pageId, reason) {
  const res = await db.query(
    `INSERT INTO blacklist (user_id, page_id, reason, spam_count, blacklisted_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       spam_count     = blacklist.spam_count + 1,
       reason         = EXCLUDED.reason,
       blacklisted_at = NOW()
     RETURNING *;`,
    [userId, pageId || null, reason || "manual"],
  );
  return res.rows[0];
}

async function remove(userId) {
  const res = await db.query("DELETE FROM blacklist WHERE user_id=$1 RETURNING *", [userId]);
  return res.rows[0];
}

async function isBlacklisted(userId) {
  const res = await db.query("SELECT 1 FROM blacklist WHERE user_id=$1 LIMIT 1", [userId]);
  return res.rowCount > 0;
}

async function getAll(limit = 100) {
  const res = await db.query("SELECT * FROM blacklist ORDER BY blacklisted_at DESC LIMIT $1", [limit]);
  return res.rows;
}

module.exports = { add, remove, isBlacklisted, getAll };
