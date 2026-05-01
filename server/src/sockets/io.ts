import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

let io: Server | null = null;

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    email: string;
  };
}

export function initSocket(httpServer: HttpServer, clientOrigin: string) {
  const allowedOrigins = clientOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, ''));
      if (!token) return next(new Error('Missing token'));
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const s = socket as AuthedSocket;
    console.log(`[socket] connected ${s.id} (user=${s.data.email})`);

    // Auto-join personal room so we can deliver DMs to all of this user's tabs/devices.
    s.join(`user:${s.data.userId}`);

    s.on('join_board', async (boardId: string, ack?: (ok: boolean, err?: string) => void) => {
      try {
        if (typeof boardId !== 'string') throw new Error('boardId must be string');
        const membership = await prisma.boardMember.findUnique({
          where: { boardId_userId: { boardId, userId: s.data.userId } },
          select: { role: true },
        });
        if (!membership) {
          ack?.(false, 'Forbidden: not a board member');
          return;
        }
        s.join(`board:${boardId}`);
        ack?.(true);
      } catch (err) {
        ack?.(false, (err as Error).message);
      }
    });

    s.on('leave_board', (boardId: string) => {
      if (typeof boardId === 'string') s.leave(`board:${boardId}`);
    });

    s.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${s.id}: ${reason}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return io;
}
