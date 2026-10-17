import { z } from 'zod';

/**
 * Default costing buckets for Consumables & Packaging. The actual accepted
 * values come from the `consumable_groups` catalog, so owners/managers can add
 * new groups ("Takeaway containers", "Trays", …) from the UI. This list is
 * only used for seeding and as a fallback label if the catalog has not loaded.
 */
export const DEFAULT_CONSUMABLE_GROUPS = [
  'Cups',
  'Lids',
  'Bags',
  'Boxes',
  'Napkins',
  'Straws',
  'Other',
] as const;

const expenseTypes = ['expense_product', 'expense_fixed', 'expense_consumable'] as const;
const units = ['kg', 'g', 'L', 'ml', 'pcs', 'box', 'pack'] as const;

/**
 * Upper bounds matching the database columns, so a mistyped amount is rejected
 * as a clear 400 instead of overflowing Decimal and surfacing as a 500.
 * `amount`/`unitPrice` are Decimal(12,2); `quantity` is Decimal(12,3).
 */
const MAX_MONEY = 9_999_999_999.99;
const MAX_QUANTITY = 999_999_999.999;

const expenseObject = z.object({
  type: z.enum(expenseTypes),
  category: z.string().min(1, 'Category is required'),
  item: z.string().optional(),
  supplier: z.string().optional(),
  quantity: z.number().positive().max(MAX_QUANTITY, 'Quantity is too large').optional(),
  unit: z.enum(units).optional(),
  unitPrice: z.number().nonnegative().max(MAX_MONEY, 'Unit price is too large').optional(),
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(MAX_MONEY, 'Amount is too large'),
  paymentMethod: z.enum(['cash', 'bank', 'bkash']),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
});

function refineConsumable(
  data: Partial<z.infer<typeof expenseObject>>,
  ctx: z.RefinementCtx,
) {
  if (data.type !== 'expense_consumable') return;
  // Group is a free-form catalog entry; just require a non-empty label so the
  // ledger row and P&L drawer always have something meaningful to display.
  if (!data.category || !data.category.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Choose a consumables group.',
      path: ['category'],
    });
  }
  if (data.quantity === undefined) {
    ctx.addIssue({ code: 'custom', message: 'Quantity is required.', path: ['quantity'] });
  }
  if (!data.unit) {
    ctx.addIssue({ code: 'custom', message: 'Unit is required.', path: ['unit'] });
  }
  if (data.unitPrice === undefined) {
    ctx.addIssue({ code: 'custom', message: 'Unit price is required.', path: ['unitPrice'] });
  }
}

export const expenseCreateSchema = expenseObject.superRefine((data, ctx) => {
  refineConsumable(data, ctx);
  if (data.type === 'expense_consumable' && !data.supplier?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Supplier is required.',
      path: ['supplier'],
    });
  }
});

export const expenseUpdateSchema = expenseObject.partial().superRefine(refineConsumable);

export const expensesListQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(expenseTypes).optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const statsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
