import { z } from 'zod';

const menuCategories = [
  'Add On',
  'Affogato',
  'Chicken',
  'Coffee',
  'Iced Coffee',
  'Milk Tea',
  'Mocktails',
  'Pasta',
  'Shakes',
  'Sides',
  'Waffle Menu',
] as const;

export const menuItemCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(menuCategories),
  price: z.number().positive('Price must be greater than 0'),
  available: z.boolean().default(true),
  description: z.string().optional(),
});

export const menuItemUpdateSchema = menuItemCreateSchema.partial();

export const menuListQuerySchema = z.object({
  category: z.enum(menuCategories).optional(),
  available: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().optional(),
});

export type MenuItemCreateInput = z.infer<typeof menuItemCreateSchema>;
