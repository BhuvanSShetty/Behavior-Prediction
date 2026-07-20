import { Router } from 'express';
import {
    getChildDashboard,
    getChildWeeklyPlaytime,
    getChildren,
    updateControls,
    linkChild,
} from '../controllers/parent.controller.js';
import { protect, requireParent } from '../middleware/auth.middleware.js';
import { validate } from '../validators/validate.js';
import {
    updateControlsSchema,
    linkChildSchema,
    childIdParamSchema,
} from '../validators/parent.validator.js';

const router = Router();

router.use(protect, requireParent);

router.get('/children', getChildren);
router.post('/link', validate(linkChildSchema), linkChild);
router.get('/dashboard/:childId', validate(childIdParamSchema), getChildDashboard);
router.get(
    '/dashboard/:childId/weekly',
    validate(childIdParamSchema),
    getChildWeeklyPlaytime,
);
router.put('/controls/:childId', validate(updateControlsSchema), updateControls);

export default router;
