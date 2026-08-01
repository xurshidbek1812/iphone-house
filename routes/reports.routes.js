import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  exportWarehouseStockReport,
  exportCashIncomeReport,
  exportExpensesReport,
  getProfitSummary,
  exportSoldItemsReport,
  exportSalesReport
} from '../controllers/reports.controller.js';

const router = express.Router();

router.get('/profit-summary',  authenticateToken, getProfitSummary);
router.get('/warehouse-stock', authenticateToken, exportWarehouseStockReport);
router.get('/cash-income',     authenticateToken, exportCashIncomeReport);
router.get('/expenses',        authenticateToken, exportExpensesReport);
router.get('/sold-items',      authenticateToken, exportSoldItemsReport);
router.get('/sales',           authenticateToken, exportSalesReport);

export default router;