# Facebook Page API Backend (Node.js)

Backend Node.js (Express) de goi Facebook Graph API cho Facebook Page.

## 1) Phan 1 - Chuan bi (can chup screenshot)

### A. Tao Facebook Page
1. Vao Facebook > Pages > Create new Page.
2. Dat ten Page, category, thong tin co ban.
3. Sau khi tao xong, vao `About` de lay Page ID.

Screenshot can nop:
- Page da tao (hien ten Page)
- Page ID

### B. Tao Facebook App (Meta for Developers)
1. Vao: https://developers.facebook.com/
2. My Apps > Create App.
3. Chon loai app phu hop (thong thuong Business).
4. Them san pham "Facebook Login" hoac cac product can dung cho Graph API.

Screenshot can nop:
- Dashboard cua app (App Name + App ID)

### C. Lay Page Access Token
1. Vao Graph API Explorer: https://developers.facebook.com/tools/explorer/
2. Chon app vua tao.
3. Lay User Access Token voi cac quyen can thiet (co the can app review voi quyen nang cao).
4. Doi sang Page Access Token cho page cua ban.

Quyen thuong dung:
- pages_show_list
- pages_read_engagement
- pages_read_user_content
- pages_manage_posts
- pages_manage_engagement
- read_insights

Screenshot can nop:
- Token (co the che bot mot phan token cho an toan)
- Danh sach permissions da cap

## 2) Cai dat backend

### Yeu cau
- Node.js 18+

### Cai dat
```bash
npm install
```

Tao file `.env` tu `.env.example`:
```env
PORT=3000
GRAPH_API_VERSION=v20.0
PAGE_ACCESS_TOKEN=your_page_access_token_here
DEFAULT_INSIGHTS_METRICS=page_impressions,page_post_engagements,page_fans
```

Chay server:
```bash
npm run dev
```
hoac
```bash
npm start
```

## Swagger API Docs

Sau khi chay server, mo Swagger UI tai:

- http://localhost:3000/api-docs

Raw OpenAPI JSON:

- http://localhost:3000/api-docs.json

Luu y khi test tren Swagger:
- Co the truyen `access_token` tren query cho tung endpoint.
- Neu da dat `PAGE_ACCESS_TOKEN` trong `.env`, ban khong can nhap token moi lan goi API.

## 3) API da xay dung

Base URL mac dinh: `http://localhost:3000`

### 1. GET /api/page/{pageId}
Lay thong tin page.

Vi du:
```bash
curl "http://localhost:3000/api/page/{pageId}"
```

### 2. GET /api/page/{pageId}/posts
Lay danh sach post cua page.

Vi du:
```bash
curl "http://localhost:3000/api/page/{pageId}/posts?limit=5"
```

### 3. POST /api/page/{pageId}/posts
Dang bai moi len page.

Body JSON:
```json
{
  "message": "Hello from API",
  "link": "https://example.com"
}
```

Vi du:
```bash
curl -X POST "http://localhost:3000/api/page/{pageId}/posts" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Hello from API\"}"
```

### 4. DELETE /api/page/post/{postId}
Xoa bai viet theo postId.

Vi du:
```bash
curl -X DELETE "http://localhost:3000/api/page/post/{postId}"
```

### 5. GET /api/page/post/{postId}/comments
Lay comments cua bai viet.

Vi du:
```bash
curl "http://localhost:3000/api/page/post/{postId}/comments?limit=10"
```

### 6. GET /api/page/post/{postId}/likes
Lay likes cua bai viet.

Vi du:
```bash
curl "http://localhost:3000/api/page/post/{postId}/likes?limit=10"
```

### 7. GET /api/page/{pageId}/insights
Lay insights cua page.

Vi du:
```bash
curl "http://localhost:3000/api/page/{pageId}/insights?period=day"
```

## 4) Truyen access token

Ung dung uu tien lay token theo thu tu:
1. Query: `access_token`
2. Header: `x-page-access-token`
3. Bien moi truong: `PAGE_ACCESS_TOKEN`

Vi du query token:
```bash
curl "http://localhost:3000/api/page/{pageId}?access_token=EAAB..."
```

## 5) Luu y
- Mot so quyen can App Review de dung tren production.
- Trong che do development, token thuong chi dung duoc voi vai tro admin/developer/tester.
- Khong commit token that len git.
