import { Router } from 'express';
import { login, me, register } from '../controllers/authController';
import { authJwt } from '../middleware/authJwt';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/me', authJwt, me);

export default router;
