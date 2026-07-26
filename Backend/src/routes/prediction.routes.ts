import { Router } from 'express';
import {
    predict,
    mlHealth,
    retrainModel,
    getRetrainStatus,
    getFeedbackStats,
    compareModels,
    getActiveModel,
    switchActiveModel,
} from '../controllers/prediction.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/health', mlHealth);
router.post('/predict', protect, predict);

// Admin-only: retrain model with all users' feedback
router.post('/retrain', protect, requireAdmin, retrainModel);
router.get('/retrain/status', protect, requireAdmin, getRetrainStatus);
router.get('/feedback-stats', protect, requireAdmin, getFeedbackStats);
router.get('/compare', protect, requireAdmin, compareModels);

// Admin-only: switch active user-facing ML model (RandomForest vs XGBoost)
router.get('/active-model', protect, requireAdmin, getActiveModel);
router.post('/active-model', protect, requireAdmin, switchActiveModel);

export default router;
