import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createMovement,
  deleteMovement,
  getAccounts,
  getBalances,
  getMovement,
  listMovements,
} from './funds.controller.js';

const router = Router();

router.use(authenticate);

router.get('/balances', asyncHandler(getBalances));
router.get('/accounts', asyncHandler(getAccounts));

router.get('/', asyncHandler(listMovements));
router.get('/:id', asyncHandler(getMovement));

// Managers may read balances and movement history. Only the owner may move money.
router.post('/', requireRole('owner'), asyncHandler(createMovement));
router.delete('/:id', requireRole('owner'), asyncHandler(deleteMovement));

export default router;
