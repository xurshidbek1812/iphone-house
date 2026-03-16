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

router.post('/transfer', authenticateToken, transferBetweenCashboxes);
router.get('/transactions/all', authenticateToken, getAllCashboxTransactions);

router.put('/:id', authenticateToken, updateCashbox);
router.patch('/:id/status', authenticateToken, updateCashboxStatus);
router.delete('/:id', authenticateToken, deleteCashbox);

router.post('/:id/deposit', authenticateToken, depositCashbox);
router.post('/:id/withdraw', authenticateToken, withdrawCashbox);
router.get('/:id/transactions', authenticateToken, getCashboxTransactions);

export default router;