import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { createMessageSchema, listMessagesSchema } from '../schemas/message';
import { getIO } from '../sockets/io';

const messageInclude = {
  user: { select: { id: true, email: true, name: true } },
} as const;

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    const { limit, before } = listMessagesSchema.parse(req.query);

    const messages = await prisma.message.findMany({
      where: {
        boardId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: messageInclude,
    });

    // Return in chronological order (oldest first) for easy rendering bottom-up.
    res.json({ messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
}

export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const boardId = req.boardId!;
    const data = createMessageSchema.parse(req.body);

    const message = await prisma.message.create({
      data: {
        boardId,
        userId: req.user.userId,
        content: data.content.trim(),
      },
      include: messageInclude,
    });

    getIO().to(`board:${boardId}`).emit('message:created', { message });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}
