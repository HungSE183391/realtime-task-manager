import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { listDMSchema, sendDMSchema } from '../schemas/dm';
import { getIO } from '../sockets/io';

const dmInclude = {
  fromUser: { select: { id: true, email: true, name: true } },
  toUser: { select: { id: true, email: true, name: true } },
} as const;

/**
 * GET /api/dm/conversations
 * Returns list of "conversations" of current user, where each entry is
 * the OTHER user with: latestMessage + unreadCount.
 */
export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const me = req.user.userId;

    // Pull all DMs involving me, latest first. We aggregate in JS for clarity.
    const dms = await prisma.directMessage.findMany({
      where: { OR: [{ fromUserId: me }, { toUserId: me }] },
      orderBy: { createdAt: 'desc' },
      include: dmInclude,
      take: 1000,
    });

    type Conv = {
      otherUser: { id: string; email: string; name: string };
      latestMessage: (typeof dms)[number];
      unreadCount: number;
    };
    const map = new Map<string, Conv>();

    for (const m of dms) {
      const other = m.fromUserId === me ? m.toUser : m.fromUser;
      const existing = map.get(other.id);
      if (!existing) {
        map.set(other.id, {
          otherUser: other,
          latestMessage: m,
          unreadCount: 0,
        });
      }
      const conv = map.get(other.id)!;
      if (m.toUserId === me && m.readAt == null) conv.unreadCount += 1;
    }

    res.json({ conversations: Array.from(map.values()) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dm/with/:userId  -- list messages between me and userId (chronological).
 * Also marks all incoming as read.
 */
export async function listMessagesWith(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const me = req.user.userId;
    const other = req.params.userId;
    const { limit } = listDMSchema.parse(req.query);

    if (me === other) throw new HttpError(400, 'Cannot fetch DMs with yourself');

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromUserId: me, toUserId: other },
          { fromUserId: other, toUserId: me },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: dmInclude,
    });

    // Mark received messages as read.
    await prisma.directMessage.updateMany({
      where: { fromUserId: other, toUserId: me, readAt: null },
      data: { readAt: new Date() },
    });

    // Notify the other user that we have read messages so their UI can update.
    getIO().to(`user:${other}`).emit('dm:read', { byUserId: me });

    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dm/with/:userId  -- send DM to userId.
 */
export async function sendDM(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const me = req.user.userId;
    const to = req.params.userId;
    const { content } = sendDMSchema.parse(req.body);

    if (me === to) throw new HttpError(400, 'Cannot DM yourself');

    const recipient = await prisma.user.findUnique({
      where: { id: to },
      select: { id: true },
    });
    if (!recipient) throw new HttpError(404, 'Recipient not found');

    const message = await prisma.directMessage.create({
      data: {
        fromUserId: me,
        toUserId: to,
        content: content.trim(),
      },
      include: dmInclude,
    });

    // Emit to BOTH personal rooms so sender's other tabs and the recipient sync.
    getIO().to(`user:${me}`).to(`user:${to}`).emit('dm:created', { message });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}
