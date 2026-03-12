import express from 'express';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { getOrders, createDirectOrder } from '../controllers/orders.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getOrders);
router.post('/direct', authenticateToken, createDirectOrder);

export default router;