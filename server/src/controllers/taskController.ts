import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { createTaskSchema, updateTaskSchema } from '../schemas/task';
import { positionBetween, positionForAppend } from '../lib/position';
import { getIO } from '../sockets/io';

const taskInclude = {
  assignedTo: { select: { id: true, email: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const columnId = req.params.id; // /columns/:id/tasks
    const boardId = req.boardId!;
    const data = createTaskSchema.parse(req.body);

    if (data.assignedToId) {
      const member = await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: data.assignedToId } },
        select: { id: true },
      });
      if (!member) throw new HttpError(400, 'Assignee is not a member of this board');
    }

    const last = await prisma.task.findFirst({
      where: { columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = positionForAppend(last?.position ?? null);

    const task = await prisma.task.create({
      data: {
        columnId,
        title: data.title,
        description: data.description ?? null,
        assignedToId: data.assignedToId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        position,
      },
      include: taskInclude,
    });

    getIO().to(`board:${boardId}`).emit('task:created', { task });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.id;
    const boardId = req.boardId!;
    const data = updateTaskSchema.parse(req.body);

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, columnId: true, column: { select: { boardId: true } } },
    });
    if (!existing) throw new HttpError(404, 'Task not found');

    if (data.assignedToId) {
      const member = await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: data.assignedToId } },
        select: { id: true },
      });
      if (!member) throw new HttpError(400, 'Assignee is not a member of this board');
    }

    if (data.columnId && data.columnId !== existing.columnId) {
      const target = await prisma.column.findUnique({
        where: { id: data.columnId },
        select: { boardId: true },
      });
      if (!target) throw new HttpError(404, 'Target column not found');
      if (target.boardId !== boardId) {
        throw new HttpError(400, 'Cannot move task across boards');
      }
    }

    const updateData: {
      title?: string;
      description?: string | null;
      completed?: boolean;
      assignedToId?: string | null;
      dueDate?: Date | null;
      columnId?: string;
      position?: number;
    } = {};

    if (data.title != null) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.completed !== undefined) updateData.completed = data.completed;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.columnId) updateData.columnId = data.columnId;

    const isMove =
      data.columnId !== undefined ||
      data.beforeId !== undefined ||
      data.afterId !== undefined;

    if (isMove) {
      const hasAnchor = data.beforeId !== undefined || data.afterId !== undefined;
      if (hasAnchor) {
        const [before, after] = await Promise.all([
          data.beforeId
            ? prisma.task.findUnique({ where: { id: data.beforeId }, select: { position: true } })
            : Promise.resolve(null),
          data.afterId
            ? prisma.task.findUnique({ where: { id: data.afterId }, select: { position: true } })
            : Promise.resolve(null),
        ]);
        updateData.position = positionBetween(before?.position ?? null, after?.position ?? null);
      } else if (data.columnId && data.columnId !== existing.columnId) {
        // Column-only move (from modal): append to the end of the target column.
        const last = await prisma.task.findFirst({
          where: { columnId: data.columnId, NOT: { id: taskId } },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        updateData.position = positionForAppend(last?.position ?? null);
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: taskInclude,
    });

    if (isMove) {
      getIO().to(`board:${boardId}`).emit('task:moved', {
        task,
        fromColumnId: existing.columnId,
        toColumnId: task.columnId,
      });
    } else {
      getIO().to(`board:${boardId}`).emit('task:updated', { task });
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.id;
    const boardId = req.boardId!;
    await prisma.task.delete({ where: { id: taskId } });
    getIO().to(`board:${boardId}`).emit('task:deleted', { taskId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
