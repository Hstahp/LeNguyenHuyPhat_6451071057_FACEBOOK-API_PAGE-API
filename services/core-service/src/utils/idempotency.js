/**
 * core-service/src/utils/idempotency.js
 * In-memory idempotency store with TTL eviction (24h default).
 */
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const store = new Map(); // key → expireAt

function has(key) {
  const expireAt = store.get(key);
  if (!expireAt) return false;
  if (Date.now() > expireAt) { store.delete(key); return false; }
  return true;
}

function add(key) {
  store.set(key, Date.now() + TTL_MS);
}

// Evict expired keys periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of store) {
    if (now > exp) store.delete(k);
  }
}, 60_000);

module.exports = { has, add };
