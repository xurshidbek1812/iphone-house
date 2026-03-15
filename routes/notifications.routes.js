import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getMyNotifications,
  readNotification,
  readAllNotifications
} from '../controllers/notifications.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getMyNotifications);
router.patch('/:id/read', authenticateToken, readNotification);
router.patch('/read-all/all', authenticateToken, readAllNotifications);

export default router;
