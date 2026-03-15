import { Router } from 'express';
import { logSession, getMySessions } from '../controllers/session.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/log', protect, logSession);
router.get('/my', protect, getMySessions);

export default router;
