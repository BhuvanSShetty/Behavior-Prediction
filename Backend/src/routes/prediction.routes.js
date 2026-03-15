import { Router } from 'express';
import { predict, mlHealth } from '../controllers/prediction.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/health', mlHealth);
router.post('/predict', protect, predict);

export default router;
