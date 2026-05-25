-- backend-api/src/db/migrations/001_init.sql
-- Schema theo tài liệu (Phụ lục A.10)

-- ── Idempotency keys (tài liệu A.10 quy định bắt buộc) ──────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
  command_id   VARCHAR(100) PRIMARY KEY,
  processed_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  status       VARCHAR(20)  NOT NULL   -- success | failed | skipped
);

-- ── Comments tracking (tài liệu A.10) ────────────────────────────────────────
-- Lưu toàn bộ lịch sử xử lý của từng bình luận
CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL       PRIMARY KEY,
  comment_id VARCHAR(100) UNIQUE NOT NULL,
  post_id    VARCHAR(100) NOT NULL,
  page_id    VARCHAR(100),
  user_id    VARCHAR(100),
  user_name  VARCHAR(255),
  message    TEXT,
  intent     VARCHAR(50),
  sentiment  VARCHAR(20),
  status     VARCHAR(50)  DEFAULT 'received',
  -- received | processed | replied | failed | spam_detected | pending_review
  action_taken VARCHAR(255),
  error_msg  TEXT,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── Blacklist ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blacklist (
  user_id        VARCHAR(255) PRIMARY KEY,
  page_id        VARCHAR(255),
  reason         TEXT,
  spam_count     INTEGER     DEFAULT 1,
  blacklisted_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ── Manual review queue ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_review_queue (
  id          SERIAL       PRIMARY KEY,
  event_id    VARCHAR(255),
  comment_id  VARCHAR(255),
  user_id     VARCHAR(255),
  message     TEXT,
  reason      TEXT,
  status      VARCHAR(50)  DEFAULT 'pending',
  -- pending | approved | rejected
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);

-- ── Command execution log (idempotency + audit) ───────────────────────────────
CREATE TABLE IF NOT EXISTS command_log (
  command_id   VARCHAR(255) PRIMARY KEY,
  action       VARCHAR(100),
  comment_id   VARCHAR(255),
  user_id      VARCHAR(255),
  status       VARCHAR(50)  DEFAULT 'pending',
  -- pending | success | failed | dead_letter | skipped_blacklisted
  retry_count  INTEGER      DEFAULT 0,
  error_msg    TEXT,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comments_status    ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_user      ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post      ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_review_status      ON manual_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_command_status     ON command_log(status);
CREATE INDEX IF NOT EXISTS idx_idempotency_status ON idempotency_keys(status);
