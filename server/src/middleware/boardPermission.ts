import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      boardId?: string;
      boardRole?: Role;
    }
  }
}

/**
 * Resolves the boardId from one of (in priority order):
 *   - req.params.boardId (explicit)
 *   - req.params.id when route is /boards/:id
 *   - via column param: /columns/:id -> column.boardId
 *   - via task param:   /tasks/:id   -> task.column.boardId
 *
 * Then verifies the JWT user is a member of that board and attaches
 * req.boardId + req.boardRole. 403 if not member, 404 if board missing.
 */
export function requireBoardMembership(opts?: { paramName?: 'boardId' | 'columnId' | 'taskId' | 'auto' }) {
  const mode = opts?.paramName ?? 'auto';

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthorized');

      let boardId: string | null = null;

      if (mode === 'auto' || mode === 'boardId') {
        boardId = req.params.boardId || req.params.id || null;
        // /boards/:id  -> id is boardId only when route mounts /boards
        if (mode === 'auto' && !req.baseUrl.includes('/boards') && !req.params.boardId) {
          boardId = null;
        }
      }

      if (!boardId && (mode === 'auto' || mode === 'columnId')) {
        const columnId = req.params.columnId || (req.baseUrl.includes('/columns') ? req.params.id : null);
        if (columnId) {
          const column = await prisma.column.findUnique({
            where: { id: columnId },
            select: { boardId: true },
          });
          if (!column) throw new HttpError(404, 'Column not found');
          boardId = column.boardId;
        }
      }

      if (!boardId && (mode === 'auto' || mode === 'taskId')) {
        const taskId = req.params.taskId || (req.baseUrl.includes('/tasks') ? req.params.id : null);
        if (taskId) {
          const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { column: { select: { boardId: true } } },
          });
          if (!task) throw new HttpError(404, 'Task not found');
          boardId = task.column.boardId;
        }
      }

      if (!boardId) throw new HttpError(400, 'Cannot resolve board id from request');

      const membership = await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: req.user.userId } },
        select: { role: true },
      });
      if (!membership) throw new HttpError(403, 'Forbidden: not a board member');

      req.boardId = boardId;
      req.boardRole = membership.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  if (req.boardRole !== Role.OWNER) {
    return next(new HttpError(403, 'Forbidden: owner only'));
  }
  next();
}
