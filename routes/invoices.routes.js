import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice
} from '../controllers/invoices.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getInvoices);
router.post('/', authenticateToken, createInvoice);
router.put('/:id', authenticateToken, updateInvoice);
router.patch('/:id/status', authenticateToken, updateInvoiceStatus);
router.delete('/:id', authenticateToken, deleteInvoice);

export default router;