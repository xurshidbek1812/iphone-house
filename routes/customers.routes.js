import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getRegions
} from '../controllers/customers.controller.js';

const router = express.Router();

router.post('/', authenticateToken, createCustomer);
router.get('/', authenticateToken, getCustomers);
router.get('/regions/all', authenticateToken, getRegions);
router.get('/:id', authenticateToken, getCustomerById);
router.put('/:id', authenticateToken, updateCustomer);
router.delete('/:id', authenticateToken, deleteCustomer);

export default router;
