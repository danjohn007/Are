import { Router } from 'express';
import authRoutes from './authRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import leadRoutes from './leadRoutes.js';
import propertyRoutes from './propertyRoutes.js';
import articleRoutes from './articleRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/leads', leadRoutes);
router.use('/properties', propertyRoutes);
router.use('/articles', articleRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
