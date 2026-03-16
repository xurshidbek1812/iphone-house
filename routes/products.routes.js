import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  archiveProductBatch,
  increaseProductStock,
  decreaseProductStock
} from '../controllers/products.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getProducts);
router.post('/', authenticateToken, createProduct);
router.put('/:id', authenticateToken, updateProduct);
router.delete('/:id', authenticateToken, deleteProduct);

router.patch('/batches/:id/archive', authenticateToken, archiveProductBatch);
router.post('/increase-stock', authenticateToken, increaseProductStock);
router.post('/decrease-stock', authenticateToken, decreaseProductStock);

export default router;