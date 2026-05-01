import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomUUID } from 'crypto';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).slice(0, 16);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});
