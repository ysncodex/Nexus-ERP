import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createSettlement,
  deleteSettlement,
  getSettlement,
  listSettlements,
  updateSettlement,
} from './deliverySettlements.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listSettlements));
router.get('/:id', asyncHandler(getSettlement));

router.post('/', requireRole('owner', 'manager'), asyncHandler(createSettlement));
router.put('/:id', requireRole('owner', 'manager'), asyncHandler(updateSettlement));
router.delete('/:id', requireRole('owner', 'manager'), asyncHandler(deleteSettlement));

export default router;
