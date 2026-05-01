# Realtime Task Manager

Web app Kanban realtime kiểu Trello/Notion mini, hỗ trợ nhiều user cùng kéo-thả task trên cùng một board, sync tức thời qua WebSocket.

## Tech stack

| Tầng | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| State | Zustand (auth) + React Query (server cache + optimistic UI) |
| Drag-drop | @dnd-kit/core + @dnd-kit/sortable |
| HTTP | axios (interceptor đính JWT) |
| Realtime | socket.io-client |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| DB | PostgreSQL |
| Realtime server | Socket.IO (chung HTTP server với Express) |
| Auth | JWT (email + password, bcrypt) |
| Validation | Zod |

## Cấu trúc

```
realtime-task-manager/
├── client/                   # React + Vite (port 5173)
│   ├── src/
│   │   ├── api/              # axios endpoint helpers
│   │   ├── components/       # Header, Column, TaskCard, AddColumnInline, modals/
│   │   ├── hooks/            # useBoardSocket
│   │   ├── lib/              # axios, socket, queryClient
│   │   ├── pages/            # LoginPage, RegisterPage, DashboardPage, BoardPage
│   │   ├── store/            # authStore (zustand + persist)
│   │   └── types/
├── server/                   # Express + Socket.IO (port 4000)
│   ├── src/
│   │   ├── controllers/      # auth, board, column, task
│   │   ├── middleware/       # authJwt, boardPermission, errorHandler
│   │   ├── routes/           # auth, boards, columns, tasks
│   │   ├── schemas/          # zod input schemas
│   │   ├── sockets/io.ts     # Socket.IO setup + JWT handshake + rooms
│   │   ├── lib/              # prisma, jwt, position
│   │   └── index.ts
│   └── prisma/schema.prisma
├── docker-compose.yml        # PostgreSQL local (optional)
└── README.md
```

## Yêu cầu môi trường

- Node.js >= 18 (đã test trên 24)
- PostgreSQL: chạy bằng Docker hoặc cài local
- npm >= 9

## Setup local

### 1. PostgreSQL

**Cách A — Docker (khuyến nghị):**
```bash
docker compose up -d postgres
```
DB: `localhost:5432`, user `rtm`, pass `rtm_password`, db `rtm`.

**Cách B — Postgres local cài sẵn:** Tạo DB `rtm` qua pgAdmin / `psql -U postgres -c "CREATE DATABASE rtm;"`. Sau đó sửa `DATABASE_URL` trong `server/.env` cho khớp user/pass của bạn.

### 2. Backend

```bash
cd server
npm install
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
npx prisma migrate dev --name init
npm run dev
```

Server chạy ở `http://localhost:4000`, Socket.IO chung port. Healthcheck: `GET http://localhost:4000/health`.

### 3. Frontend

```bash
cd client
npm install
copy .env.example .env       # Windows (optional, defaults sẵn)
npm run dev
```

Mở `http://localhost:5173`. Vite dev server đã proxy `/api` và `/socket.io` sang backend `:4000`.

## API endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/auth/register` | - | Tạo user, trả `{user, token}` |
| POST | `/api/auth/login` | - | Login, trả `{user, token}` |
| GET | `/api/me` | JWT | User info từ token |
| GET | `/api/boards` | JWT | List boards user tham gia |
| POST | `/api/boards` | JWT | Tạo board (auto OWNER) |
| GET | `/api/boards/:id` | member | Detail + columns + tasks lồng |
| PATCH | `/api/boards/:id` | owner | Đổi title |
| DELETE | `/api/boards/:id` | owner | Xóa board (cascade) |
| POST | `/api/boards/:id/members` | owner | Invite by email |
| DELETE | `/api/boards/:id/members/:userId` | owner | Kick member |
| POST | `/api/boards/:id/columns` | member | Thêm column |
| PATCH | `/api/columns/:id` | member | Rename / reorder (`beforeId`/`afterId`) |
| DELETE | `/api/columns/:id` | member | Xóa column |
| POST | `/api/columns/:id/tasks` | member | Thêm task |
| PATCH | `/api/tasks/:id` | member | Update / move (`columnId` + `beforeId`/`afterId`) |
| DELETE | `/api/tasks/:id` | member | Xóa task |

## Socket events

**Client → server:**
- `join_board(boardId, ack)` — server check membership rồi `socket.join('board:'+id)`
- `leave_board(boardId)`

**Server → client (broadcast trong room `board:<boardId>`):**
- `board:updated`, `board:deleted`
- `member:joined`, `member:left`
- `column:created`, `column:updated`, `column:deleted`
- `task:created`, `task:updated`, `task:moved`, `task:deleted`

## Realtime + drag-drop flow

1. User kéo task → `onDragEnd` của dnd-kit
2. Tính `beforeId` / `afterId` (anchors quanh vị trí drop)
3. **Optimistic**: snapshot cache rồi `queryClient.setQueryData` để UI cập nhật ngay
4. `PATCH /api/tasks/:id { columnId, beforeId, afterId }`
5. Server tính position float = `(before.position + after.position) / 2`, update DB, emit `task:moved` vào room
6. Các client khác (và cả client A) nhận event → `useBoardSocket` patch cache (idempotent — đã dedup)
7. Nếu API fail → rollback bằng snapshot

Position dùng float `gap strategy` (step 1024). Khi gap < `0.0001`, helper `rebalancePositions` trong `server/src/lib/position.ts` có thể spread lại đều.

## Test nhanh

1. Mở 2 trình duyệt (hoặc 1 chrome + 1 incognito)
2. Đăng ký 2 tài khoản, ví dụ `a@a.com` và `b@b.com`
3. Tài khoản A: tạo board "Demo" → thêm 3 columns "Todo / Doing / Done" → thêm vài tasks
4. Tài khoản A: bấm **Members** → invite email `b@b.com`
5. Tài khoản B refresh dashboard → thấy board "Demo" → mở
6. Trên A kéo task qua column khác — B sẽ thấy update tức thời

## Deploy production

**Backend (Railway / Render / Docker):**
- Build: `npm run build` → `dist/`
- Start: `node dist/index.js`
- Env required: `DATABASE_URL`, `JWT_SECRET` (chuỗi dài random), `JWT_EXPIRES_IN`, `PORT`, `CLIENT_ORIGIN`
- Chạy migration trên prod: `npx prisma migrate deploy`

**Frontend (Vercel / Netlify):**
- Build cmd: `npm run build`
- Output dir: `dist`
- Env: `VITE_API_URL=https://your-backend.com`, `VITE_SOCKET_URL=https://your-backend.com`

**CORS:** đảm bảo backend `CLIENT_ORIGIN` khớp domain frontend.

## Roadmap mở rộng

- [ ] Optimistic UI cho create/delete (hiện chỉ optimistic cho move task)
- [ ] Rebalance positions tự động khi gap quá nhỏ
- [ ] Comments + activity log trên task
- [ ] Labels / tags
- [ ] OAuth Google (đã chừa chỗ trong stack)
- [ ] Mobile responsive cho board view
- [ ] Soft delete + undo
