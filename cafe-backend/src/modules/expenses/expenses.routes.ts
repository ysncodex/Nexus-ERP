import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createConsumableGroupCatalog,
  createConsumableItemCatalog,
  createFixedCostItemCatalog,
  createProductCostItemCatalog,
  deleteConsumableGroupCatalog,
  deleteConsumableItemCatalog,
  deleteFixedCostItemCatalog,
  deleteProductCostItemCatalog,
  listConsumableGroupCatalog,
  listConsumableItemCatalog,
  listFixedCostItemCatalog,
  listProductCostItemCatalog,
  renameConsumableGroupCatalog,
  renameConsumableItemCatalog,
  renameFixedCostItemCatalog,
  renameProductCostItemCatalog,
} from './catalog.controller.js';
import {
  consumableCosts,
  createExpense,
  deleteExpense,
  expenseStats,
  fixedCosts,
  getExpense,
  listExpenses,
  productCosts,
  updateExpense,
} from './expenses.controller.js';

const router = Router();

router.use(authenticate);

router.get('/stats', asyncHandler(expenseStats));
router.get('/product-costs', asyncHandler(productCosts));
router.get('/fixed-costs', asyncHandler(fixedCosts));
router.get('/consumable-costs', asyncHandler(consumableCosts));

router.get('/catalog/fixed-items', asyncHandler(listFixedCostItemCatalog));
router.post('/catalog/fixed-items', requireRole('owner', 'manager'), asyncHandler(createFixedCostItemCatalog));
router.put('/catalog/fixed-items/:id', requireRole('owner', 'manager'), asyncHandler(renameFixedCostItemCatalog));
router.delete('/catalog/fixed-items/:id', requireRole('owner', 'manager'), asyncHandler(deleteFixedCostItemCatalog));

router.get('/catalog/consumable-groups', asyncHandler(listConsumableGroupCatalog));
router.post('/catalog/consumable-groups', requireRole('owner', 'manager'), asyncHandler(createConsumableGroupCatalog));
router.put('/catalog/consumable-groups/:id', requireRole('owner', 'manager'), asyncHandler(renameConsumableGroupCatalog));
router.delete('/catalog/consumable-groups/:id', requireRole('owner', 'manager'), asyncHandler(deleteConsumableGroupCatalog));

router.get('/catalog/consumable-items', asyncHandler(listConsumableItemCatalog));
router.post('/catalog/consumable-items', requireRole('owner', 'manager'), asyncHandler(createConsumableItemCatalog));
router.put('/catalog/consumable-items/:id', requireRole('owner', 'manager'), asyncHandler(renameConsumableItemCatalog));
router.delete('/catalog/consumable-items/:id', requireRole('owner', 'manager'), asyncHandler(deleteConsumableItemCatalog));

router.get('/catalog/product-items', asyncHandler(listProductCostItemCatalog));
router.post('/catalog/product-items', requireRole('owner', 'manager'), asyncHandler(createProductCostItemCatalog));
router.put('/catalog/product-items/:id', requireRole('owner', 'manager'), asyncHandler(renameProductCostItemCatalog));
router.delete('/catalog/product-items/:id', requireRole('owner', 'manager'), asyncHandler(deleteProductCostItemCatalog));

router.get('/', asyncHandler(listExpenses));
router.get('/:id', asyncHandler(getExpense));

router.post('/', requireRole('owner', 'manager'), asyncHandler(createExpense));
router.put('/:id', requireRole('owner', 'manager'), asyncHandler(updateExpense));
router.delete('/:id', requireRole('owner', 'manager'), asyncHandler(deleteExpense));

export default router;
