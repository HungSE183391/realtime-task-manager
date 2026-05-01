import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { UPLOADS_DIR } from '../lib/upload';
import { getIO } from '../sockets/io';

const userSelect = { id: true, email: true, name: true } as const;

export async function listAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = req.params.id;
    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: userSelect } },
    });
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
}

export async function createAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const taskId = req.params.id;
    const boardId = req.boardId!;
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file uploaded');

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        userId: req.user.userId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      include: { user: { select: userSelect } },
    });

    getIO().to(`board:${boardId}`).emit('attachment:created', { attachment, taskId });
    res.status(201).json({ attachment });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => undefined);
    }
    next(err);
  }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const attachmentId = req.params.id;

    const existing = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        userId: true,
        taskId: true,
        filename: true,
        task: { select: { column: { select: { boardId: true } } } },
      },
    });
    if (!existing) throw new HttpError(404, 'Attachment not found');

    const boardId = existing.task.column.boardId;
    const membership = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: req.user.userId } },
      select: { role: true },
    });
    if (!membership) throw new HttpError(403, 'Forbidden: not a board member');

    if (existing.userId !== req.user.userId && membership.role !== 'OWNER') {
      throw new HttpError(403, 'Only the uploader or board owner can delete this file');
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });

    const filePath = path.join(UPLOADS_DIR, existing.filename);
    fs.unlink(filePath, () => undefined);

    getIO()
      .to(`board:${boardId}`)
      .emit('attachment:deleted', { attachmentId, taskId: existing.taskId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const attachmentId = req.params.id;
    const att = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: {
        filename: true,
        originalName: true,
        mimeType: true,
        task: { select: { column: { select: { boardId: true } } } },
      },
    });
    if (!att) throw new HttpError(404, 'Attachment not found');

    if (!req.user) throw new HttpError(401, 'Unauthorized');
    const boardId = att.task.column.boardId;
    const membership = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: req.user.userId } },
      select: { id: true },
    });
    if (!membership) throw new HttpError(403, 'Forbidden: not a board member');

    const filePath = path.join(UPLOADS_DIR, att.filename);
    if (!fs.existsSync(filePath)) throw new HttpError(404, 'File missing on server');

    res.setHeader('Content-Type', att.mimeType);
    const inline = req.query.inline === '1';
    const dispositionType = inline ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(att.originalName)}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}
