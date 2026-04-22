import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { login, me, refreshToken } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post(
  '/login',
  [body('email').isEmail(), body('password').isLength({ min: 6 })],
  validateRequest,
  asyncHandler(login)
);

router.post('/refresh', [body('refreshToken').isString().notEmpty()], validateRequest, asyncHandler(refreshToken));
router.get('/me', authenticate, asyncHandler(me));

export default router;
