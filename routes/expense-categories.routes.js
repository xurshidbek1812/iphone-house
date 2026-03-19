import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getExpenseCategoryGroups,
  createExpenseCategoryGroup,
  updateExpenseCategoryGroup,
  deleteExpenseCategoryGroup,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory
} from '../controllers/expense-categories.controller.js';

const router = express.Router();

router.get('/groups', authenticateToken, getExpenseCategoryGroups);
router.post('/groups', authenticateToken, createExpenseCategoryGroup);
router.put('/groups/:id', authenticateToken, updateExpenseCategoryGroup);
router.delete('/groups/:id', authenticateToken, deleteExpenseCategoryGroup);

router.post('/', authenticateToken, createExpenseCategory);
router.put('/:id', authenticateToken, updateExpenseCategory);
router.delete('/:id', authenticateToken, deleteExpenseCategory);

export default router;