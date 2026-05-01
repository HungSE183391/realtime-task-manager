import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserSchema,
} from '../schemas/admin';
import { getIO } from '../sockets/io';

const SALT_ROUNDS = 10;

const userAdminSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  _count: {
    select: {
      ownedBoards: true,
      memberships: true,
      assignedTasks: true,
    },
  },
} as const;

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, limit } = listUsersQuerySchema.parse(req.query);
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      take: limit ?? 100,
      select: userAdminSelect,
    });

    const totalUsers = await prisma.user.count();
    const totalAdmins = await prisma.user.count({ where: { role: UserRole.ADMIN } });

    res.json({ users, totals: { users: totalUsers, admins: totalAdmins } });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const targetId = req.params.id;
    const data = updateUserSchema.parse(req.body);

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true },
    });
    if (!target) throw new HttpError(404, 'User not found');

    if (data.email && data.email !== target.email) {
      const conflict = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });
      if (conflict) throw new HttpError(409, 'Email already in use');
    }

    const updateData: { name?: string; email?: string; passwordHash?: string } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: userAdminSelect,
    });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const targetId = req.params.id;
    const { role } = updateUserRoleSchema.parse(req.body);

    if (targetId === req.user.userId) {
      throw new HttpError(400, 'You cannot change your own role');
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });
    if (!target) throw new HttpError(404, 'User not found');

    if (role === UserRole.USER && target.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) {
        throw new HttpError(400, 'Cannot demote the last admin');
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: userAdminSelect,
    });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const targetId = req.params.id;

    if (targetId === req.user.userId) {
      throw new HttpError(400, 'You cannot delete your own account');
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });
    if (!target) throw new HttpError(404, 'User not found');

    if (target.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) {
        throw new HttpError(400, 'Cannot delete the last admin');
      }
    }

    // Boards owned by this user must be removed first (boards are not auto-cascaded
    // from User; only BoardMember + assigned tasks are nullified/cascaded).
    const ownedBoards = await prisma.board.findMany({
      where: { ownerId: targetId },
      select: { id: true },
    });
    for (const b of ownedBoards) {
      await prisma.board.delete({ where: { id: b.id } });
      getIO().to(`board:${b.id}`).emit('board:deleted', { boardId: b.id });
    }

    // Detach assignments + memberships + DMs/comments to keep referential integrity.
    await prisma.task.updateMany({
      where: { assignedToId: targetId },
      data: { assignedToId: null },
    });
    await prisma.boardMember.deleteMany({ where: { userId: targetId } });
    await prisma.directMessage.deleteMany({
      where: { OR: [{ fromUserId: targetId }, { toUserId: targetId }] },
    });
    await prisma.message.deleteMany({ where: { userId: targetId } });
    await prisma.comment.deleteMany({ where: { userId: targetId } });
    await prisma.attachment.deleteMany({ where: { userId: targetId } });

    await prisma.user.delete({ where: { id: targetId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listAllBoards(_req: Request, res: Response, next: NextFunction) {
  try {
    const boards = await prisma.board.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { members: true, columns: true } },
      },
    });
    res.json({ boards });
  } catch (err) {
    next(err);
  }
}

export async function deleteAnyBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.id;
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true },
    });
    if (!board) throw new HttpError(404, 'Board not found');

    await prisma.board.delete({ where: { id: boardId } });
    getIO().to(`board:${boardId}`).emit('board:deleted', { boardId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [users, admins, boards, tasks, comments, attachments] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.board.count(),
      prisma.task.count(),
      prisma.comment.count(),
      prisma.attachment.count(),
    ]);
    res.json({ stats: { users, admins, boards, tasks, comments, attachments } });
  } catch (err) {
    next(err);
  }
}
