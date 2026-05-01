import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

export interface VoiceParticipant {
  socketId: string;
  userId: string;
  name: string;
  muted: boolean;
}

const voiceRooms = new Map<string, Map<string, VoiceParticipant>>();

const MAX_PARTICIPANTS_PER_ROOM = 12;

function getRoom(boardId: string): Map<string, VoiceParticipant> {
  let room = voiceRooms.get(boardId);
  if (!room) {
    room = new Map();
    voiceRooms.set(boardId, room);
  }
  return room;
}

function listParticipants(boardId: string): VoiceParticipant[] {
  const room = voiceRooms.get(boardId);
  if (!room) return [];
  return Array.from(room.values());
}

function listOtherParticipants(boardId: string, excludeSocketId: string): VoiceParticipant[] {
  return listParticipants(boardId).filter((p) => p.socketId !== excludeSocketId);
}

function broadcastRoomState(io: Server, boardId: string) {
  const participants = listParticipants(boardId);
  io.to(`board:${boardId}`).emit('voice:room-state', { boardId, participants });
}

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    voiceBoards?: Set<string>;
  };
}

export function registerVoiceHandlers(io: Server, socket: AuthedSocket) {
  const userId = socket.data.userId;

  socket.on(
    'voice:list',
    async (
      payload: { boardId: string },
      ack?: (
        result:
          | { ok: true; participants: VoiceParticipant[] }
          | { ok: false; error: string },
      ) => void,
    ) => {
      try {
        const boardId = payload?.boardId;
        if (typeof boardId !== 'string' || !boardId) {
          ack?.({ ok: false, error: 'boardId required' });
          return;
        }
        const membership = await prisma.boardMember.findUnique({
          where: { boardId_userId: { boardId, userId } },
          select: { role: true },
        });
        if (!membership) {
          ack?.({ ok: false, error: 'Not a board member' });
          return;
        }
        ack?.({ ok: true, participants: listParticipants(boardId) });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on(
    'voice:join',
    async (
      payload: { boardId: string },
      ack?: (
        result:
          | { ok: true; participants: VoiceParticipant[] }
          | { ok: false; error: string },
      ) => void,
    ) => {
      try {
        const boardId = payload?.boardId;
        if (typeof boardId !== 'string' || !boardId) {
          ack?.({ ok: false, error: 'boardId required' });
          return;
        }

        const membership = await prisma.boardMember.findUnique({
          where: { boardId_userId: { boardId, userId } },
          select: { role: true },
        });
        if (!membership) {
          ack?.({ ok: false, error: 'Not a board member' });
          return;
        }

        const room = getRoom(boardId);
        if (room.size >= MAX_PARTICIPANTS_PER_ROOM && !room.has(socket.id)) {
          ack?.({ ok: false, error: `Voice room is full (max ${MAX_PARTICIPANTS_PER_ROOM})` });
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        if (!user) {
          ack?.({ ok: false, error: 'User not found' });
          return;
        }

        const participant: VoiceParticipant = {
          socketId: socket.id,
          userId,
          name: user.name,
          muted: false,
        };

        const others = listOtherParticipants(boardId, socket.id);

        room.set(socket.id, participant);
        socket.join(`voice:${boardId}`);
        // Track which voice rooms this socket is in for cleanup on disconnect.
        const joined = (socket.data.voiceBoards as Set<string> | undefined) ?? new Set<string>();
        joined.add(boardId);
        socket.data.voiceBoards = joined;

        socket.to(`voice:${boardId}`).emit('voice:peer-joined', { participant });
        broadcastRoomState(io, boardId);

        ack?.({ ok: true, participants: others });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on('voice:leave', (payload: { boardId: string }) => {
    const boardId = payload?.boardId;
    if (typeof boardId !== 'string' || !boardId) return;
    leaveVoiceRoom(io, socket, boardId);
  });

  socket.on(
    'voice:signal',
    (payload: {
      boardId: string;
      to: string;
      signal: { type: 'offer' | 'answer' | 'ice'; data: unknown };
    }) => {
      if (
        !payload ||
        typeof payload.boardId !== 'string' ||
        typeof payload.to !== 'string' ||
        !payload.signal
      ) {
        return;
      }
      const room = voiceRooms.get(payload.boardId);
      if (!room || !room.has(socket.id) || !room.has(payload.to)) return;

      io.to(payload.to).emit('voice:signal', {
        boardId: payload.boardId,
        from: socket.id,
        signal: payload.signal,
      });
    },
  );

  socket.on('voice:state', (payload: { boardId: string; muted: boolean }) => {
    if (!payload || typeof payload.boardId !== 'string') return;
    const room = voiceRooms.get(payload.boardId);
    const participant = room?.get(socket.id);
    if (!participant) return;
    participant.muted = !!payload.muted;
    socket
      .to(`voice:${payload.boardId}`)
      .emit('voice:peer-state', { socketId: socket.id, muted: participant.muted });
    broadcastRoomState(io, payload.boardId);
  });

  socket.on('disconnect', () => {
    const joined = socket.data.voiceBoards as Set<string> | undefined;
    if (!joined) return;
    for (const boardId of joined) {
      leaveVoiceRoom(io, socket, boardId);
    }
  });
}

function leaveVoiceRoom(io: Server, socket: AuthedSocket, boardId: string) {
  const room = voiceRooms.get(boardId);
  if (!room) return;
  if (!room.has(socket.id)) return;
  room.delete(socket.id);
  socket.leave(`voice:${boardId}`);
  socket.to(`voice:${boardId}`).emit('voice:peer-left', { socketId: socket.id });
  if (room.size === 0) voiceRooms.delete(boardId);
  const joined = socket.data.voiceBoards as Set<string> | undefined;
  joined?.delete(boardId);
  broadcastRoomState(io, boardId);
}
