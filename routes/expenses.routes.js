import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

import {
  getExpenses,
  createExpense,
  approveExpense,
  cancelExpense,
  deleteExpense
} from '../controllers/expenses.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getExpenses);
router.post('/', authenticateToken, createExpense);
router.patch('/:id/approve', authenticateToken, approveExpense);
router.patch('/:id/cancel', authenticateToken, cancelExpense);
router.delete('/:id', authenticateToken, deleteExpense);

export default router;