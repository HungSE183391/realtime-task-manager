import { Router } from 'express';
import { authJwt } from '../middleware/authJwt';
import { requireBoardMembership } from '../middleware/boardPermission';
import {
  createColumn,
  deleteColumn,
  updateColumn,
} from '../controllers/columnController';
import { createTask } from '../controllers/taskController';

const router = Router();

router.use(authJwt);

// POST /api/boards/:boardId/columns is mounted at parent; here we expose:
// PATCH/DELETE /api/columns/:id
// POST /api/columns/:id/tasks (create task in this column)
router.patch('/:id', requireBoardMembership({ paramName: 'columnId' }), updateColumn);
router.delete('/:id', requireBoardMembership({ paramName: 'columnId' }), deleteColumn);
router.post('/:id/tasks', requireBoardMembership({ paramName: 'columnId' }), createTask);

export default router;
