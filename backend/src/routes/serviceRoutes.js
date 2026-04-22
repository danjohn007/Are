import { Router } from 'express';
import { body } from 'express-validator';
import {
  createService,
  deleteService,
  exportServicePdf,
  getServiceById,
  getServices,
  updateService
} from '../controllers/serviceController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', asyncHandler(getServices));
router.get('/:id', asyncHandler(getServiceById));
router.get('/:id/pdf', asyncHandler(exportServicePdf));

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [body('name').isString().notEmpty(), body('slug').isString().notEmpty(), body('price').isNumeric()],
  validateRequest,
  asyncHandler(createService)
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [body('name').isString().notEmpty(), body('slug').isString().notEmpty(), body('price').isNumeric()],
  validateRequest,
  asyncHandler(updateService)
);

router.delete('/:id', authenticate, authorize('admin'), asyncHandler(deleteService));

export default router;
