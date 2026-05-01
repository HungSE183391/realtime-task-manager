import { Router } from 'express';
import { authJwt } from '../middleware/authJwt';
import { requireBoardMembership, requireOwner } from '../middleware/boardPermission';
import {
  createBoard,
  deleteBoard,
  getBoard,
  inviteMember,
  listBoards,
  removeMember,
  updateBoard,
} from '../controllers/boardController';
import { createColumn } from '../controllers/columnController';
import { createMessage, listMessages } from '../controllers/messageController';

const router = Router();

router.use(authJwt);

router.get('/', listBoards);
router.post('/', createBoard);

router.get('/:id', requireBoardMembership(), getBoard);
router.patch('/:id', requireBoardMembership(), requireOwner, updateBoard);
router.delete('/:id', requireBoardMembership(), requireOwner, deleteBoard);

router.post('/:id/members', requireBoardMembership(), requireOwner, inviteMember);
router.delete('/:id/members/:userId', requireBoardMembership(), requireOwner, removeMember);

router.post('/:id/columns', requireBoardMembership(), createColumn);

router.get('/:id/messages', requireBoardMembership(), listMessages);
router.post('/:id/messages', requireBoardMembership(), createMessage);

export default router;
