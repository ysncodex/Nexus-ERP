import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  approvePayroll,
  createPayroll,
  createShift,
  createStaff,
  getPayroll,
  getStatus,
  importLegacy,
  listPayroll,
  listShifts,
  listStaff,
  recordPayment,
  reversePayment,
  updatePayroll,
  updateShift,
  updateStaff,
  voidPayroll,
} from './hr.controller.js';

const router = Router();

// Salaries and staff records are owner-only, matching the Staff Schedule / Payroll pages.
router.use(authenticate, requireRole('owner'));

router.get('/status', asyncHandler(getStatus));
router.post('/import', asyncHandler(importLegacy));

router.get('/staff', asyncHandler(listStaff));
router.post('/staff', asyncHandler(createStaff));
router.put('/staff/:id', asyncHandler(updateStaff));

router.get('/shifts', asyncHandler(listShifts));
router.post('/shifts', asyncHandler(createShift));
router.put('/shifts/:id', asyncHandler(updateShift));

router.get('/payroll', asyncHandler(listPayroll));
router.get('/payroll/:id', asyncHandler(getPayroll));
router.post('/payroll', asyncHandler(createPayroll));
router.put('/payroll/:id', asyncHandler(updatePayroll));
router.post('/payroll/:id/approve', asyncHandler(approvePayroll));
router.post('/payroll/:id/void', asyncHandler(voidPayroll));
router.post('/payroll/:id/payments', asyncHandler(recordPayment));
router.delete('/payroll/:id/payments/:paymentId', asyncHandler(reversePayment));

export default router;
