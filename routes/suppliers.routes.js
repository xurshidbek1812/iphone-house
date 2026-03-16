import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../controllers/suppliers.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getSuppliers);
router.post('/', authenticateToken, createSupplier);
router.put('/:id', authenticateToken, updateSupplier);
router.delete('/:id', authenticateToken, deleteSupplier);

export default router;