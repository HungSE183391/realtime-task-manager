import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { HttpError } from '../middleware/errorHandler';
import { loginSchema, registerSchema } from '../schemas/auth';

const SALT_ROUNDS = 10;

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, 'Email already in use');

    // First-ever user becomes ADMIN automatically.
    const userCount = await prisma.user.count();
    const role: UserRole = userCount === 0 ? UserRole.ADMIN : UserRole.USER;

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email: data.email, passwordHash, name: data.name, role },
      select: userPublicSelect,
    });

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new HttpError(401, 'Invalid email or password');

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Invalid email or password');

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userPublicSelect,
    });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
