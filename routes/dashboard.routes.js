import express from 'express';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getDashboard);

export default router;