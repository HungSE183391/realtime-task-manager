import { Router } from 'express';
import { authJwt } from '../middleware/authJwt';
import {
  listConversations,
  listMessagesWith,
  sendDM,
} from '../controllers/dmController';

const router = Router();

router.use(authJwt);

router.get('/conversations', listConversations);
router.get('/with/:userId', listMessagesWith);
router.post('/with/:userId', sendDM);

export default router;
