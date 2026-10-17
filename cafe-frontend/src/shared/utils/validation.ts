import { z } from 'zod';

// Sale Transaction Schema
export const saleSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Amount must be a positive number',
    }),
  description: z.string().min(1, 'Description is required').max(200, 'Max 200 characters'),
  method: z.enum(['cash', 'bank', 'bkash']),
  channel: z.enum(['in_store', 'foodpanda', 'foodi']),
  isAdjustment: z.boolean(),
});

// Product Cost/Expense Schema
export const productCostSchema = z.object({
  item: z.string().min(1, 'Item name is required').max(100),
  supplier: z.string().min(1, 'Supplier is required').max(100),
  quantity: z
    .string()
    .min(1, 'Quantity is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Quantity must be positive',
    }),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'pcs', 'box', 'pack']),
  unitPrice: z
    .string()
    .min(1, 'Unit price is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Unit price must be positive',
    }),
  cost: z.string().optional(), // Auto-calculated field
  method: z.enum(['cash', 'bank', 'bkash']),
  description: z.string().max(200).optional(),
});

// Consumables & Packaging — quantity costing, grouped so cups are not mixed
// with bags. Mirrors Purchases: user types the total amount paid and the
// quantity, and the form derives unit price for the ledger row.
export const consumableSchema = z.object({
  group: z.string().trim().min(1, 'Group is required').max(50),
  item: z.string().trim().min(1, 'Item name is required').max(100),
  supplier: z.string().trim().min(1, 'Supplier is required').max(100),
  cost: z
    .string()
    .min(1, 'Total amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Total amount must be positive',
    }),
  quantity: z
    .string()
    .min(1, 'Quantity is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Quantity must be positive',
    }),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'pcs', 'box', 'pack']),
  // Auto-calculated from cost ÷ quantity; keep as a string in form state so
  // the readonly input and submission payload stay in sync.
  unitPrice: z.string().optional(),
  method: z.enum(['cash', 'bank', 'bkash']),
  note: z.string().trim().max(200).optional(),
});

// Fixed Cost Schema
export const fixedCostSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Amount must be positive',
    }),
  method: z.enum(['cash', 'bank', 'bkash']),
});

// Login Schema
export const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// Manager Password Schema
export const managerPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// Settings Schema
export const settingsSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(100),
  businessAddress: z.string().max(200).optional(),
  businessPhone: z.string().max(20).optional(),
  businessEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  currency: z.string().default('৳'),
  taxRate: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
      message: 'Tax rate must be between 0-100',
    })
    .optional(),
  fiscalYearStart: z.string().optional(),
});

// Export types
export type SaleFormData = z.infer<typeof saleSchema>;
export type ProductCostFormData = z.infer<typeof productCostSchema>;
export type ConsumableFormData = z.infer<typeof consumableSchema>;
export type FixedCostFormData = z.infer<typeof fixedCostSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ManagerPasswordFormData = z.infer<typeof managerPasswordSchema>;
export type SettingsFormData = z.infer<typeof settingsSchema>;
