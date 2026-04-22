import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createLead, deleteLead, getLeadById, getLeads, updateLead } from '../controllers/leadController.js';

const router = Router();

const leadValidation = [
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('phone').isString().notEmpty(),
  body('message').optional().isString(),
  body('service_id').optional().isInt(),
  body('property_id').optional().isInt(),
  body('status').optional().isIn(['new', 'contacted', 'closed']),
  body('source').optional().isString()
];

router.post('/', leadValidation, validateRequest, asyncHandler(createLead));
router.get('/', authenticate, authorize('admin'), asyncHandler(getLeads));
router.get('/:id', authenticate, authorize('admin'), asyncHandler(getLeadById));
router.put('/:id', authenticate, authorize('admin'), leadValidation, validateRequest, asyncHandler(updateLead));
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(deleteLead));

export default router;
