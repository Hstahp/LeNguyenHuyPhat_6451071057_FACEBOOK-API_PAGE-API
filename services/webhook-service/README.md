# webhook-service

**Port:** 3001  
**Role:** Nhận webhook từ Facebook, xác thực chữ ký, normalize payload và publish vào Kafka topic `raw_events`.

## Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/` | Health check |
| GET | `/webhook` | Facebook verification handshake |
| POST | `/webhook` | Nhận Facebook webhook events |

## Kafka Output

- **Topic:** `raw_events`
- **Key:** `pageId` hoặc `senderId`

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Normalized Event Schema

```json
{
  "source": "facebook",
  "schemaVersion": "1.0.0",
  "eventType": "comment_created | message_received | post_created",
  "pageId": "...",
  "senderId": "...",
  "commentId": "...",
  "postId": "...",
  "message": "...",
  "eventTime": "ISO8601",
  "raw": {}
}
```
