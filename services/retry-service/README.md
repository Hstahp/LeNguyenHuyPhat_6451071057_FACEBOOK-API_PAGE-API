# retry-service

**Port:** 3003  
**Role:** Consume `retry_events`, áp dụng exponential backoff, re-publish sang `reply_commands`. Sau N lần thất bại → `dead_letter`.

## Retry Logic

| Lần | Delay |
|-----|-------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |
| > 5 | → dead_letter |

## Kafka

| Direction | Topic | Mô tả |
|-----------|-------|-------|
| Consume | `retry_events` | Nhận từ backend-api khi FB API call thất bại |
| Publish | `reply_commands` | Re-queue để backend-api thử lại |
| Publish | `dead_letter` | Khi vượt quá MAX_RETRIES |

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```
