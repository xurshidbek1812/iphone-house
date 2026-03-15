import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getCashboxes,
  createCashbox,
  updateCashbox,
  deleteCashbox,
  updateCashboxStatus,
  depositCashbox,
  withdrawCashbox,
  getCashboxTransactions,
  transferBetweenCashboxes,
  getAllCashboxTransactions
} from '../controllers/cashboxes.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getCashboxes);
router.post('/', authenticateToken, createCashbox);
router.put('/:id', authenticateToken, updateCashbox);
router.delete('/:id', authenticateToken, deleteCashbox);
router.patch('/:id/status', authenticateToken, updateCashboxStatus);
router.post('/:id/deposit', authenticateToken, depositCashbox);
router.post('/:id/withdraw', authenticateToken, withdrawCashbox);
router.get('/:id/transactions', authenticateToken, getCashboxTransactions);
router.post('/transfer', authenticateToken, transferBetweenCashboxes);
router.get('/transactions/all', authenticateToken, getAllCashboxTransactions);

export default router;
