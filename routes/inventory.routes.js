import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  finishInventory,
  getInventoryHistory
} from '../controllers/inventory.controller.js';

const router = express.Router();

router.post('/finish', authenticateToken, finishInventory);
router.get('/history', authenticateToken, getInventoryHistory);

export default router;