# backend-api

**Port:** 3000  
**Role:** Service duy nhất gọi Facebook Graph API. Consume `reply_commands` từ Kafka để thực thi hành động trên Facebook. Quản lý blacklist, event tracking, manual review queue qua PostgreSQL.

## Kafka

| Direction | Topic | Mô tả |
|-----------|-------|-------|
| Consume | `reply_commands` | Lệnh từ core-service để thực thi lên Facebook |
| Consume | `processed_events` | Cập nhật trạng thái event vào DB |
| Consume | `manual_review` | Nhập hàng chờ admin |
| Publish | `retry_events` | Khi FB API call thất bại |

## REST API

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check |
| GET | `/api/events` | Danh sách events theo status |
| GET | `/api/blacklist` | Danh sách blacklist |
| POST | `/api/blacklist` | Thêm user vào blacklist |
| DELETE | `/api/blacklist/:userId` | Xóa khỏi blacklist |
| GET | `/api/review` | Manual review queue |
| POST | `/api/review/:id/approve` | Duyệt + xử lý |
| POST | `/api/review/:id/reject` | Từ chối |

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```
