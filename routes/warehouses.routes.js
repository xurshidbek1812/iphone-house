import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  transferStock,
  getStockTransfers
} from '../controllers/warehouses.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getWarehouses);
router.post('/', authenticateToken, createWarehouse);
router.put('/:id', authenticateToken, updateWarehouse);
router.post('/transfer', authenticateToken, transferStock);
router.get('/transfers', authenticateToken, getStockTransfers);

export default router;
