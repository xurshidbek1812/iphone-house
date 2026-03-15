import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getBlacklistRequests,
  createBlacklistRequest,
  updateBlacklistRequest,
  updateBlacklistRequestStatus,
  deleteBlacklistRequest
} from '../controllers/blacklist.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getBlacklistRequests);
router.post('/', authenticateToken, createBlacklistRequest);
router.put('/:id', authenticateToken, updateBlacklistRequest);
router.patch('/:id/status', authenticateToken, updateBlacklistRequestStatus);
router.delete('/:id', authenticateToken, deleteBlacklistRequest);

export default router;