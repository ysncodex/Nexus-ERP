import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginController, verifyController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Throttle brute-force attempts against the login endpoint. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, asyncHandler(loginController));
router.get('/verify', authenticate, asyncHandler(verifyController));

export default router;
