import { Router } from 'express';
import { authJwt } from '../middleware/authJwt';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  deleteAnyBoard,
  deleteUser,
  getStats,
  listAllBoards,
  listUsers,
  updateUser,
  updateUserRole,
} from '../controllers/adminController';

const router = Router();

router.use(authJwt, requireAdmin);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/boards', listAllBoards);
router.delete('/boards/:id', deleteAnyBoard);

export default router;
