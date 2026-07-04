/**
 * Beans & Butter default menu — mirrored from the frontend POS catalog.
 * Stable IDs match the frontend so seeded rows stay in sync across client reloads.
 */

export type SeedMenuCategory =
  | 'Add On'
  | 'Affogato'
  | 'Chicken'
  | 'Coffee'
  | 'Iced Coffee'
  | 'Milk Tea'
  | 'Mocktails'
  | 'Pasta'
  | 'Shakes'
  | 'Sides'
  | 'Waffle Menu';

export interface SeedMenuItem {
  id: string;
  name: string;
  category: SeedMenuCategory;
  price: number;
  available: boolean;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const RAW: Omit<SeedMenuItem, 'id'>[] = [
  { name: 'Americano', category: 'Coffee', price: 150, available: true },
  { name: 'Cappuccino', category: 'Coffee', price: 210, available: true },
  { name: 'Espresso (Single)', category: 'Coffee', price: 70, available: true },
  { name: 'Espresso (Double)', category: 'Coffee', price: 120, available: true },
  { name: 'Hazelnut Latte', category: 'Coffee', price: 260, available: true },
  { name: 'Hot Chocolate', category: 'Coffee', price: 110, available: true },
  { name: 'Hot Mocha', category: 'Coffee', price: 190, available: true },
  { name: 'Iced Blended Cookies Mocha', category: 'Iced Coffee', price: 310, available: true },
  { name: 'Iced Shaken Hazelnut Espresso', category: 'Iced Coffee', price: 350, available: true },
  { name: 'Iced Spanish Latte', category: 'Iced Coffee', price: 290, available: true },
  { name: 'Chocolate Milk Tea with Boba', category: 'Milk Tea', price: 250, available: true },
  { name: 'Chocolate Milk Tea with Ice Cream', category: 'Milk Tea', price: 310, available: true },
  { name: 'Hazelnut Milk Tea with Boba', category: 'Milk Tea', price: 270, available: true },
  { name: 'Hazelnut Milk Tea with Ice Cream', category: 'Milk Tea', price: 330, available: true },
  { name: 'Ice Mango Tea with Boba (No Milk)', category: 'Milk Tea', price: 150, available: true },
  { name: 'Mango Milk Tea with Boba', category: 'Milk Tea', price: 250, available: true },
  { name: 'Mango Milk Tea with Ice Cream', category: 'Milk Tea', price: 310, available: true },
  { name: 'Apple Fizz', category: 'Mocktails', price: 170, available: true },
  { name: 'Blue Lagoon Mojito', category: 'Mocktails', price: 130, available: true },
  { name: 'Boozy Blueberry', category: 'Mocktails', price: 170, available: true },
  { name: 'Mango Carnival', category: 'Mocktails', price: 140, available: true },
  { name: 'Orange Glo', category: 'Mocktails', price: 170, available: true },
  { name: 'Virgin Mojito', category: 'Mocktails', price: 100, available: true },
  { name: 'Boba Affogato', category: 'Affogato', price: 240, available: true },
  { name: 'Hazelnut Affogato', category: 'Affogato', price: 200, available: true },
  { name: 'Oreo Affogato', category: 'Affogato', price: 180, available: true },
  { name: 'Chocolate Shake', category: 'Shakes', price: 170, available: true },
  { name: 'Mango Chocolate Shake (Boba Added)', category: 'Shakes', price: 250, available: true },
  { name: 'Mango Shake', category: 'Shakes', price: 200, available: true },
  { name: 'Mango Strawberry Shake (Boba Added)', category: 'Shakes', price: 250, available: true },
  { name: 'Oreo KitKat Shake', category: 'Shakes', price: 240, available: true },
  { name: 'Strawberry Shake', category: 'Shakes', price: 220, available: true },
  { name: 'Banana Mango Wrapper', category: 'Waffle Menu', price: 220, available: true },
  { name: 'Choco Waffle', category: 'Waffle Menu', price: 120, available: true },
  { name: 'KitKat Carnival', category: 'Waffle Menu', price: 210, available: true },
  { name: 'Nutella Overload with Ice Cream', category: 'Waffle Menu', price: 170, available: true },
  { name: 'Oreo Choco Waffle', category: 'Waffle Menu', price: 210, available: true },
  { name: 'Strawberry Nutella Waffle', category: 'Waffle Menu', price: 220, available: true },
  { name: 'Triple Choco Bliss', category: 'Waffle Menu', price: 200, available: true },
  { name: 'Tropical Mango Drizzle', category: 'Waffle Menu', price: 200, available: true },
  { name: 'Vanilla Dessert', category: 'Waffle Menu', price: 250, available: true },
  { name: 'Whippy Chocolate Waffle', category: 'Waffle Menu', price: 180, available: true },
  { name: 'White Mango Wrapper', category: 'Waffle Menu', price: 200, available: true },
  { name: 'White Waffle', category: 'Waffle Menu', price: 130, available: true },
  { name: 'Cheesy Egg Sausage Combo', category: 'Chicken', price: 180, available: true },
  { name: 'Chicken Crunch Sandwich', category: 'Chicken', price: 260, available: true },
  { name: 'Chicken Duo Sandwich', category: 'Chicken', price: 240, available: true },
  { name: 'Sausage Bowl', category: 'Chicken', price: 250, available: true },
  { name: 'Creamy Garlic Fettuccine', category: 'Pasta', price: 320, available: true },
  { name: 'Creamy Garlic Fettuccine with Chicken', category: 'Pasta', price: 400, available: true },
  { name: 'Spicy Peri Peri Pasta', category: 'Pasta', price: 350, available: true },
  { name: 'Peri Peri Potato Wedges', category: 'Sides', price: 120, available: true },
  { name: 'Spicy Street Fries', category: 'Sides', price: 110, available: true },
  { name: 'Extra Boba', category: 'Add On', price: 90, available: true },
  { name: 'Extra Nutella', category: 'Add On', price: 55, available: true },
  { name: 'Extra Nuts', category: 'Add On', price: 35, available: true },
  { name: 'Ice Cream', category: 'Add On', price: 60, available: true },
];

export const SEED_MENU: SeedMenuItem[] = RAW.map((item, index) => ({
  ...item,
  // Creates IDs like: "coffee-americano-1" or "waffle-menu-nutella-overload-with-ice-cream-36"
  id: `${slugify(item.category)}-${slugify(item.name)}-${index + 1}`,
}));
