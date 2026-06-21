import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../utils/permissions.js';
import {
  getActivityLogs,
  getActivityEntityTypes,
  getActivityActors
} from '../controllers/activity.controller.js';

const router = express.Router();

router.get('/', authenticateToken, requirePermission(PERMISSIONS.AUDIT_VIEW), getActivityLogs);
router.get(
  '/entity-types',
  authenticateToken,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  getActivityEntityTypes
);
router.get(
  '/actors',
  authenticateToken,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  getActivityActors
);

export default router;
