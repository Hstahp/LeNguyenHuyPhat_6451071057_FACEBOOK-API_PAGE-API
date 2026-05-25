/**
 * core-service/src/services/rateLimiter.js
 * Sliding window rate limiter per senderId
 * Default: 20 comments / 60 seconds → pending_review
 */
const config = require("../config");

const windows = new Map(); // senderId → [timestamp, ...]

function check(senderId) {
  if (!senderId) return { limited: false };

  const now    = Date.now();
  const window = config.rateLimit.windowMs;
  const max    = config.rateLimit.maxComments;

  let timestamps = (windows.get(senderId) || []).filter(t => now - t < window);
  timestamps.push(now);
  windows.set(senderId, timestamps);

  if (timestamps.length > max) {
    return { limited: true, count: timestamps.length, window };
  }
  return { limited: false, count: timestamps.length };
}

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  const window = config.rateLimit.windowMs;
  for (const [id, ts] of windows) {
    const filtered = ts.filter(t => now - t < window);
    if (filtered.length === 0) windows.delete(id);
    else windows.set(id, filtered);
  }
}, 5 * 60 * 1000);

module.exports = { check };
