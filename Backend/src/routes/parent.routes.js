import { Router } from 'express';
import { getChildDashboard, getChildren, updateControls, linkChild } from '../controllers/parent.controller.js';
import { protect, requireParent } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect, requireParent);

router.get('/children', getChildren);
router.post('/link', linkChild);
router.get('/dashboard/:childId', getChildDashboard);
router.put('/controls/:childId', updateControls);

export default router;
