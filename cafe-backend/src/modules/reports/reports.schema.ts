import { z } from 'zod';
import { menuCategories } from '../menu/menu.schema.js';

export const productSalesQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .optional(),
  category: z.enum(menuCategories).optional(),
  menuItemId: z.string().optional(),
  posChannel: z.enum(['in_store', 'takeaway', 'delivery']).optional(),
});

export const dailyQuerySchema = z.object({
  date: z.string().min(1, 'date is required (YYYY-MM-DD)'),
});

export const monthlyQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format'),
});

export const rangeQuerySchema = z.object({
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
});

export const exportQuerySchema = z.object({
  type: z.enum(['daily', 'monthly', 'custom']).default('custom'),
  format: z.enum(['pdf', 'excel', 'csv']).default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
