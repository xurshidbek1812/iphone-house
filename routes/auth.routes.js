import express from 'express';
import { login } from '../controllers/auth.controller.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/login', loginRateLimiter, login);

export default router;