import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schema.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(controller.register));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword),
);

export default router;
