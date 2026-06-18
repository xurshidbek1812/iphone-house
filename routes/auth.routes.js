import express from 'express';
import { login } from '../controllers/auth.controller.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.get('/test-notification', async (req, res) => {
  await createDirectorNotification({
    type: 'TEST',
    title: 'Test notification',
    message: 'Notification ishlayaptimi'
  });

  res.json({ success: true });
});

router.post('/login', loginRateLimiter, login);

export default router;