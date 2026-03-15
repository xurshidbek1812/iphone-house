import express from 'express';
import {
  getContracts,
  getContractById,
  createContractDraft,
  updateContractDraft,
  confirmContract,
  deleteContract,
  addContractComment,
  collectContractPayment
} from '../controllers/contracts.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getContracts);
router.get('/:id', authenticateToken, getContractById);
router.post('/', authenticateToken, createContractDraft);
router.post('/:id/payment', authenticateToken, collectContractPayment);
router.put('/:id', authenticateToken, updateContractDraft);
router.patch('/:id/confirm', authenticateToken, confirmContract);
router.post('/:id/comments', authenticateToken, addContractComment);
router.delete('/:id', authenticateToken, deleteContract);

export default router;