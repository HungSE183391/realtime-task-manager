import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { UserRole } from '@prisma/client';

import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import columnRoutes from './routes/columns';
import taskRoutes from './routes/tasks';
import dmRoutes from './routes/dm';
import adminRoutes from './routes/admin';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initSocket } from './sockets/io';
import { prisma } from './lib/prisma';

const app = express();
const PORT = Number(process.env.PORT || 4000);
// Support multiple comma-separated origins, e.g. "https://app.vercel.app,https://app-git-main.vercel.app"
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server) or matching origin
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer, CLIENT_ORIGIN);

httpServer.listen(PORT, async () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] CORS origin: ${CLIENT_ORIGIN}`);

  // Bootstrap: ensure at least one ADMIN exists. Promote the oldest user.
  try {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount === 0) {
      const oldest = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
      if (oldest) {
        await prisma.user.update({
          where: { id: oldest.id },
          data: { role: UserRole.ADMIN },
        });
        console.log(`[server] auto-promoted ${oldest.email} to ADMIN (no admin existed)`);
      }
    }
  } catch (err) {
    console.warn('[server] admin bootstrap skipped:', (err as Error).message);
  }
});

const shutdown = (signal: string) => {
  console.log(`\n[server] received ${signal}, shutting down...`);
  httpServer.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
