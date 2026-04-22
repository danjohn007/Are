import { Router } from 'express';
import { body } from 'express-validator';
import {
  createProperty,
  deleteProperty,
  getProperties,
  getPropertyById,
  manualTokkoSync,
  updateProperty
} from '../controllers/propertyController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

router.get('/', asyncHandler(getProperties));
router.get('/:id', asyncHandler(getPropertyById));

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [body('title').isString().notEmpty(), body('price').isNumeric()],
  validateRequest,
  asyncHandler(createProperty)
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [body('title').isString().notEmpty(), body('price').isNumeric()],
  validateRequest,
  asyncHandler(updateProperty)
);

router.delete('/:id', authenticate, authorize('admin'), asyncHandler(deleteProperty));
router.post('/sync/tokko', authenticate, authorize('admin'), asyncHandler(manualTokkoSync));

export default router;
