import { Router } from 'express';
import {
    logSession,
    getMySessions,
    submitSessionFeedback,
} from '../controllers/session.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../validators/validate.js';
import {
    logSessionSchema,
    feedbackSchema,
} from '../validators/session.validator.js';

const router = Router();

router.post('/log', protect, validate(logSessionSchema), logSession);
router.get('/my', protect, getMySessions);
router.post(
    '/:sessionId/feedback',
    protect,
    validate(feedbackSchema),
    submitSessionFeedback,
);

export default router;
