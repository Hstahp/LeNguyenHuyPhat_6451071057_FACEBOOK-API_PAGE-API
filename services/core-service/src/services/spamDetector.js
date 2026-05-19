/**
 * core-service/src/services/spamDetector.js
 * Phát hiện spam: link, nội dung lặp, pattern độc hại
 */

// Pattern chứa URL
const URL_REGEX = /https?:\/\/\S+|www\.\S+/i;
// Pattern scam/malicious keywords
const SCAM_REGEX = /kiếm tiền online|click vào link|nhận thưởng ngay|free gift|bit\.ly|tinyurl/i;
// Pattern bot-like (nhiều ký tự đặc biệt hoặc emoji lặp)
const BOT_REGEX = /(.)\1{9,}/; // một ký tự lặp >= 10 lần

// Track nội dung lặp: senderId → [{ message, ts }]
const recentMessages = new Map();
const WINDOW_MS      = 24 * 60 * 60 * 1000; // 24h

function getHistory(senderId) {
  const now = Date.now();
  let history = recentMessages.get(senderId) || [];
  // Evict entries older than window
  history = history.filter(e => now - e.ts < WINDOW_MS);
  recentMessages.set(senderId, history);
  return history;
}

function recordMessage(senderId, message) {
  const history = getHistory(senderId);
  history.push({ message: message.trim().toLowerCase(), ts: Date.now() });
  recentMessages.set(senderId, history);
}

function countRepeats(senderId, message) {
  const normalized = message.trim().toLowerCase();
  return getHistory(senderId).filter(e => e.message === normalized).length;
}

/**
 * @returns {{ isSpam: boolean, type: string, severity: 'light'|'heavy'|'malicious' }}
 */
function detect(event) {
  const msg = event.message || "";

  if (!msg) return { isSpam: false };

  // Malicious / scam
  if (SCAM_REGEX.test(msg)) {
    return { isSpam: true, type: "scam_link", severity: "malicious" };
  }

  // Bot-like
  if (BOT_REGEX.test(msg)) {
    return { isSpam: true, type: "bot_pattern", severity: "malicious" };
  }

  // Contains external URL
  if (URL_REGEX.test(msg)) {
    return { isSpam: true, type: "external_link", severity: "light" };
  }

  // Repeated content within 24h
  const repeatCount = countRepeats(event.senderId, msg);
  if (repeatCount >= 3) {
    return { isSpam: true, type: "repeated_content", severity: "heavy", repeatCount };
  }

  // Record for future repeat check
  recordMessage(event.senderId, msg);
  return { isSpam: false };
}

module.exports = { detect };
