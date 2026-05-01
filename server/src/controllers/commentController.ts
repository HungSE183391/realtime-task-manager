import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { createCommentSchema } from '../schemas/comment';
import { getIO } from '../sockets/io';

const userSelect = { id: true, email: true, name: true } as const;

export async function listComments(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.id;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: userSelect } },
    });
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

export async function createComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const taskId = req.params.id;
    const boardId = req.boardId!;
    const { content } = createCommentSchema.parse(req.body);

    const comment = await prisma.comment.create({
      data: { taskId, userId: req.user.userId, content },
      include: { user: { select: userSelect } },
    });

    getIO().to(`board:${boardId}`).emit('comment:created', { comment, taskId });
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const commentId = req.params.id;

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        taskId: true,
        task: { select: { column: { select: { boardId: true } } } },
      },
    });
    if (!existing) throw new HttpError(404, 'Comment not found');

    const boardId = existing.task.column.boardId;
    const membership = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: req.user.userId } },
      select: { role: true },
    });
    if (!membership) throw new HttpError(403, 'Forbidden: not a board member');

    if (existing.userId !== req.user.userId && membership.role !== 'OWNER') {
      throw new HttpError(403, 'Only the author or board owner can delete this comment');
    }

    await prisma.comment.delete({ where: { id: commentId } });

    getIO()
      .to(`board:${boardId}`)
      .emit('comment:deleted', { commentId, taskId: existing.taskId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
