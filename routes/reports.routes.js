import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  exportWarehouseStockReport,
  exportCashIncomeReport,
  exportExpensesReport
} from '../controllers/reports.controller.js';

const router = express.Router();

router.get('/warehouse-stock', authenticateToken, exportWarehouseStockReport);
router.get('/cash-income', authenticateToken, exportCashIncomeReport);
router.get('/expenses', authenticateToken, exportExpensesReport);

export default router;