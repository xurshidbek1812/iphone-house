import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getCashSales,
  createCashSale,
  updateCashSale,
  approveCashSale,
  deleteCashSale
} from '../controllers/cash-sales.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getCashSales);
router.post('/', authenticateToken, createCashSale);
router.put('/:id', authenticateToken, updateCashSale);
router.patch('/:id/approve', authenticateToken, approveCashSale);
router.delete('/:id', authenticateToken, deleteCashSale);

export default router;