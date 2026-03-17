import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 10, // 15 minutda ko'pi bilan 10 ta urinish
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Juda ko'p login urinish bo'ldi. Iltimos, 15 minutdan keyin qayta urinib ko'ring."
  }
});