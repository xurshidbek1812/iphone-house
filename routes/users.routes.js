import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getUsers,
  getMe,
  getUsersSimpleList,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/users.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getUsers);
router.get('/me', authenticateToken, getMe);
router.post('/', authenticateToken, createUser);
router.put('/:id', authenticateToken, updateUser);
router.delete('/:id', authenticateToken, deleteUser);
router.get('/simple-list', authenticateToken, getUsersSimpleList);

export default router;