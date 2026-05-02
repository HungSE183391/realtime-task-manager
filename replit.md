# Realtime Task Manager

A Kanban-style realtime task manager (like Trello/Notion mini) supporting multiple users dragging and dropping tasks on shared boards, synced instantly via WebSocket.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| State | Zustand (auth) + React Query (server cache + optimistic UI) |
| Drag-drop | @dnd-kit/core + @dnd-kit/sortable |
| HTTP | axios (interceptor with JWT) |
| Realtime | socket.io-client |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| DB | PostgreSQL (Replit managed) |
| Realtime server | Socket.IO (shared with Express HTTP server) |
| Auth | JWT (email + password, bcrypt) |
| Validation | Zod |

## Project Structure

```
realtime-task-manager/
├── client/                   # React + Vite (port 5000 in dev)
│   ├── src/
│   │   ├── api/              # axios endpoint helpers
│   │   ├── components/       # Header, Column, TaskCard, AddColumnInline, modals
│   │   ├── hooks/            # useBoardSocket
│   │   ├── lib/              # axios, socket, queryClient
│   │   ├── pages/            # LoginPage, RegisterPage, DashboardPage, BoardPage
│   │   ├── store/            # authStore (zustand + persist)
│   │   └── types/
├── server/                   # Express + Socket.IO (port 4000)
│   ├── src/
│   │   ├── controllers/      # auth, board, column, task, admin, dm
│   │   ├── middleware/       # authJwt, boardPermission, errorHandler
│   │   ├── routes/           # auth, boards, columns, tasks, dm, admin
│   │   ├── schemas/          # zod input schemas
│   │   ├── sockets/          # io.ts (Socket.IO setup + JWT handshake + rooms), voice.ts
│   │   ├── lib/              # prisma, jwt, position
│   │   └── index.ts
│   └── prisma/               # schema.prisma + migrations
├── start.sh                  # Dev startup script
└── replit.md
```

## Environment Setup

### Development
- Backend runs on `http://localhost:4000`
- Frontend runs on `http://0.0.0.0:5000` (Vite dev server with proxy to backend)
- Vite proxies `/api` and `/socket.io` requests to the backend

### Environment Variables
- `DATABASE_URL` — Replit managed PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `JWT_EXPIRES_IN` — Token expiry (default: 7d)
- `PORT` — Backend port (default: 4000)
- `CLIENT_ORIGIN` — Allowed CORS origin for backend

## Running the App

The workflow `Start application` runs `start.sh` which:
1. Starts the backend (nodemon + ts-node) on port 4000
2. Starts the frontend (Vite) on port 5000

## Database

Uses Replit's built-in managed PostgreSQL. Prisma migrations are applied with:
```bash
cd server && npx prisma migrate deploy
```

## Features

- User registration and login (JWT auth)
- Create and manage boards
- Add/rename/delete columns
- Add/update/delete tasks (with descriptions, due dates, assignees, completion)
- Drag-and-drop task reordering (float position "gap strategy")
- Real-time sync across multiple users via Socket.IO
- Board member management (invite/kick by email)
- Direct messages between users
- Comments and attachments on tasks
- Admin role (auto-promoted to oldest user)
- Board chat/messaging
