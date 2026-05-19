# core-service

**Port:** 3002  
**Role:** Consume `raw_events` từ Kafka → chạy spam detection + AI analysis (Groq) → publish `reply_commands` và `processed_events`.

## Pipeline xử lý

```
raw_events → idempotency check → rate limit check
           → spam detection → action decision
           → AI analysis (Groq) → action decision
           → publish reply_commands + processed_events
```

## Kafka

| Direction | Topic | Mô tả |
|-----------|-------|-------|
| Consume | `raw_events` | Nhận từ webhook-service |
| Publish | `reply_commands` | Lệnh cho backend-api thực thi lên Facebook |
| Publish | `processed_events` | Trạng thái xử lý event |
| Publish | `manual_review` | Đưa vào hàng chờ admin |

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```
