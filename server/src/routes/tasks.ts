import { Router } from 'express';
import { authJwt } from '../middleware/authJwt';
import { requireBoardMembership } from '../middleware/boardPermission';
import { deleteTask, updateTask } from '../controllers/taskController';
import {
  createComment,
  deleteComment,
  listComments,
} from '../controllers/commentController';
import {
  createAttachment,
  deleteAttachment,
  downloadAttachment,
  listAttachments,
} from '../controllers/attachmentController';
import { uploadAttachment } from '../lib/upload';

const router = Router();

router.use(authJwt);

router.patch('/:id', requireBoardMembership({ paramName: 'taskId' }), updateTask);
router.delete('/:id', requireBoardMembership({ paramName: 'taskId' }), deleteTask);

router.get('/:id/comments', requireBoardMembership({ paramName: 'taskId' }), listComments);
router.post('/:id/comments', requireBoardMembership({ paramName: 'taskId' }), createComment);

router.get('/:id/attachments', requireBoardMembership({ paramName: 'taskId' }), listAttachments);
router.post(
  '/:id/attachments',
  requireBoardMembership({ paramName: 'taskId' }),
  uploadAttachment.single('file'),
  createAttachment,
);

router.get('/attachments/:id/download', downloadAttachment);
router.delete('/attachments/:id', deleteAttachment);
router.delete('/comments/:id', deleteComment);

export default router;
