import { Router } from 'express';
import { body } from 'express-validator';
import {
  createArticle,
  deleteArticle,
  getArticleById,
  getArticles,
  updateArticle
} from '../controllers/articleController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

router.get('/', asyncHandler(getArticles));
router.get('/:id', asyncHandler(getArticleById));

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [body('title').isString().notEmpty(), body('slug').isString().notEmpty(), body('content').isString().notEmpty()],
  validateRequest,
  asyncHandler(createArticle)
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [body('title').isString().notEmpty(), body('slug').isString().notEmpty(), body('content').isString().notEmpty()],
  validateRequest,
  asyncHandler(updateArticle)
);

router.delete('/:id', authenticate, authorize('admin'), asyncHandler(deleteArticle));

export default router;
