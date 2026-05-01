import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from './errorHandler';

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });
    if (!user) throw new HttpError(401, 'Unauthorized');
    if (user.role !== UserRole.ADMIN) {
      throw new HttpError(403, 'Forbidden: admin only');
    }
    next();
  } catch (err) {
    next(err);
  }
}
