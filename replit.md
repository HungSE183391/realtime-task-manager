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

## Design System

Premium dark glassmorphism UI inspired by Linear/Notion/Stripe:

- **Background**: `#080c14` with radial violet/cyan gradient overlays
- **Primary**: Violet `#7c3aed` / `#8b5cf6`
- **Accent**: Cyan `#06b6d4`
- **Typography**: Inter (Google Fonts) — tight tracking, clear hierarchy
- **Surfaces**: `glass`, `glass-md`, `glass-strong`, `card`, `card-interactive`
- **Buttons**: `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `btn-icon`
- **Forms**: `.input`, `.label`, `.select`
- **Badges**: `badge-owner`, `badge-member`, `badge-admin`
- **Animations**: Framer Motion throughout — spring physics, staggered lists, slide panels

## Project Structure

```
realtime-task-manager/
├── client/                   # React + Vite (port 5000 in dev)
│   ├── src/
│   │   ├── api/              # axios endpoint helpers
│   │   ├── components/       # Header, Column, TaskCard, AddColumnInline, modals
│   │   │   ├── modals/       # Modal, AddBoardModal, TaskDetailModal, InviteMemberModal
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── DMHub.tsx
│   │   │   ├── TaskComments.tsx
│   │   │   ├── TaskAttachments.tsx
│   │   │   ├── VoiceRoomPanel.tsx
│   │   │   └── VoiceAudioMounter.tsx
│   │   ├── hooks/            # useBoardSocket, useDMSocket, useVoiceRoom
│   │   ├── lib/              # axios, socket, queryClient
│   │   ├── pages/            # LoginPage, RegisterPage, DashboardPage, BoardPage, AdminPage
│   │   ├── store/            # authStore (zustand + persist), dmHubStore
│   │   └── types/
│   ├── src/index.css         # Full design system: glass, btn-*, input, label, badge, skeleton
│   └── tailwind.config.js    # Extended palette: brand (violet), accent (cyan), surface colors
├── server/                   # Express + Socket.IO (port 4000)
│   ├── src/
│   │   ├── controllers/      # auth, board, column, task, admin, dm, message, attachment
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
- Add/rename/delete columns (inline, sortable via DnD)
- Add/update/delete tasks (descriptions, due dates, assignees, completion toggle)
- Drag-and-drop task reordering + column reordering (optimistic UI)
- Real-time sync across multiple users via Socket.IO
- Board member management (invite/remove by email)
- Direct messages between users (DMHub slide-over panel)
- Comments and file attachments on tasks
- Admin role (auto-promoted to oldest user)
- Board chat panel (per-board messaging)
- Voice rooms (WebRTC peer-to-peer audio)
