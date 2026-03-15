import express from 'express';
import {
  getOrders,
  createDirectOrder,
  deleteOrder,
  updateOrderDraft,
  confirmOrder,
  collectOrderPayment
} from '../controllers/orders.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getOrders);
router.post('/direct', authenticateToken, createDirectOrder);
router.put('/:id', authenticateToken, updateOrderDraft);
router.patch('/:id/confirm', authenticateToken, confirmOrder);
router.post('/:id/payments', authenticateToken, collectOrderPayment);
router.delete('/:id', authenticateToken, deleteOrder);

export default router;