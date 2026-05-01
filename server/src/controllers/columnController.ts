import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { createColumnSchema, updateColumnSchema } from '../schemas/column';
import { positionForAppend, positionBetween } from '../lib/position';
import { getIO } from '../sockets/io';

export async function createColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    const data = createColumnSchema.parse(req.body);

    let position = data.position;
    if (position == null) {
      const last = await prisma.column.findFirst({
        where: { boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = positionForAppend(last?.position ?? null);
    }

    const column = await prisma.column.create({
      data: { boardId, title: data.title, position },
      include: { tasks: true },
    });

    getIO().to(`board:${boardId}`).emit('column:created', { column });
    res.status(201).json({ column });
  } catch (err) {
    next(err);
  }
}

export async function updateColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const columnId = req.params.id;
    const boardId = req.boardId!;
    const data = updateColumnSchema.parse(req.body);

    const updateData: { title?: string; position?: number } = {};
    if (data.title != null) updateData.title = data.title;

    if (data.position != null) {
      updateData.position = data.position;
    } else if (data.beforeId !== undefined || data.afterId !== undefined) {
      const [before, after] = await Promise.all([
        data.beforeId
          ? prisma.column.findUnique({ where: { id: data.beforeId }, select: { position: true } })
          : Promise.resolve(null),
        data.afterId
          ? prisma.column.findUnique({ where: { id: data.afterId }, select: { position: true } })
          : Promise.resolve(null),
      ]);
      updateData.position = positionBetween(before?.position ?? null, after?.position ?? null);
    }

    const column = await prisma.column.update({
      where: { id: columnId },
      data: updateData,
    });

    getIO().to(`board:${boardId}`).emit('column:updated', { column });
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

export async function deleteColumn(req: Request, res: Response, next: NextFunction) {
  try {
    const columnId = req.params.id;
    const boardId = req.boardId!;
    await prisma.column.delete({ where: { id: columnId } });
    getIO().to(`board:${boardId}`).emit('column:deleted', { columnId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
