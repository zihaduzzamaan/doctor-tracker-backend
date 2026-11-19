import { Router } from 'express';
import { getAnalyticsSummary } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get('/summary', getAnalyticsSummary);
