import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import {
  createBoardSchema,
  inviteMemberSchema,
  updateBoardSchema,
} from '../schemas/board';
import { getIO } from '../sockets/io';

export async function listBoards(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const memberships = await prisma.boardMember.findMany({
      where: { userId: req.user.userId },
      include: {
        board: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            createdAt: true,
            _count: { select: { members: true, columns: true } },
          },
        },
      },
      orderBy: { board: { createdAt: 'desc' } },
    });

    const boards = memberships.map((m) => ({
      ...m.board,
      role: m.role,
    }));
    res.json({ boards });
  } catch (err) {
    next(err);
  }
}

export async function createBoard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const data = createBoardSchema.parse(req.body);

    const board = await prisma.board.create({
      data: {
        title: data.title,
        ownerId: req.user.userId,
        members: {
          create: { userId: req.user.userId, role: Role.OWNER },
        },
      },
      select: { id: true, title: true, ownerId: true, createdAt: true },
    });

    res.status(201).json({ board: { ...board, role: Role.OWNER } });
  } catch (err) {
    next(err);
  }
}

export async function getBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                assignedTo: { select: { id: true, email: true, name: true } },
                _count: { select: { comments: true, attachments: true } },
              },
            },
          },
        },
      },
    });
    if (!board) throw new HttpError(404, 'Board not found');
    res.json({ board, role: req.boardRole });
  } catch (err) {
    next(err);
  }
}

export async function updateBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    const data = updateBoardSchema.parse(req.body);
    const board = await prisma.board.update({
      where: { id: boardId },
      data: { title: data.title },
      select: { id: true, title: true, ownerId: true, createdAt: true },
    });
    getIO().to(`board:${boardId}`).emit('board:updated', { board });
    res.json({ board });
  } catch (err) {
    next(err);
  }
}

export async function deleteBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    await prisma.board.delete({ where: { id: boardId } });
    getIO().to(`board:${boardId}`).emit('board:deleted', { boardId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    const { email } = inviteMemberSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(404, 'User with that email not found');

    const existing = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
    });
    if (existing) throw new HttpError(409, 'User is already a member');

    const member = await prisma.boardMember.create({
      data: { boardId, userId: user.id, role: Role.MEMBER },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    getIO().to(`board:${boardId}`).emit('member:joined', { member });
    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const boardId = req.boardId!;
    const userIdToRemove = req.params.userId;

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (!board) throw new HttpError(404, 'Board not found');
    if (board.ownerId === userIdToRemove) {
      throw new HttpError(400, 'Cannot remove the board owner');
    }

    await prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId: userIdToRemove } },
    });

    getIO().to(`board:${boardId}`).emit('member:left', { userId: userIdToRemove });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
