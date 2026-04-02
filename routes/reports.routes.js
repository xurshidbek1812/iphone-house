import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { exportWarehouseStockReport } from '../controllers/reports.controller.js';

const router = express.Router();

router.get('/warehouse-stock', authenticateToken, exportWarehouseStockReport);

export default router;