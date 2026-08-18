import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { businessMonthEndKey, todayBusinessKey } from '../../utils/businessDate.js';
import { dateRangeWhere } from '../../utils/query.js';
import { serializeTransaction } from '../../utils/serialize.js';
import { parseMenuCategory, serializeMenuCategory } from '../../utils/menuCategory.js';
import {
  dailyQuerySchema,
  exportQuerySchema,
  monthlyQuerySchema,
  productSalesQuerySchema,
  rangeQuerySchema,
} from './reports.schema.js';

type Range = ReturnType<typeof dateRangeWhere>;

async function salesByMethod(range: Range) {
  const rows = await prisma.transaction.groupBy({
    by: ['method'],
    where: { type: 'sale', ...range },
    _sum: { amount: true },
  });
  const get = (m: string) => Number(rows.find((r) => r.method === m)?._sum.amount ?? 0);
  return { cash: get('cash'), bank: get('bank'), bkash: get('bkash') };
}

async function salesByChannel(range: Range) {
  const rows = await prisma.transaction.groupBy({
    by: ['channel'],
    where: { type: 'sale', ...range },
    _sum: { amount: true },
  });
  const get = (c: string) => Number(rows.find((r) => r.channel === c)?._sum.amount ?? 0);
  return { in_store: get('in_store'), foodpanda: get('foodpanda'), foodi: get('foodi') };
}

async function expenseTotals(range: Range) {
  const rows = await prisma.transaction.groupBy({
    by: ['type'],
    where: { type: { in: ['expense_product', 'expense_fixed'] }, ...range },
    _sum: { amount: true },
  });
  const get = (t: string) => Number(rows.find((r) => r.type === t)?._sum.amount ?? 0);
  return { productCosts: get('expense_product'), fixedCosts: get('expense_fixed') };
}

async function totalSales(range: Range) {
  const agg = await prisma.transaction.aggregate({
    where: { type: 'sale', ...range },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

const margin = (profit: number, revenue: number) =>
  revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;

export async function dailyReport(req: Request, res: Response) {
  const { date } = dailyQuerySchema.parse(req.query);
  const range = dateRangeWhere(date, date);

  const [sales, methods, expenses] = await Promise.all([
    totalSales(range),
    salesByMethod(range),
    expenseTotals(range),
  ]);
  const totalExpenses = expenses.productCosts + expenses.fixedCosts;

  res.json({
    date,
    totalSales: sales,
    totalExpenses,
    profit: sales - totalExpenses,
    salesBreakdown: methods,
    expensesBreakdown: expenses,
  });
}

export async function monthlyReport(req: Request, res: Response) {
  const { month } = monthlyQuerySchema.parse(req.query);
  const range = dateRangeWhere(`${month}-01`, businessMonthEndKey(month));

  const [sales, channels, expenses, byCategory] = await Promise.all([
    totalSales(range),
    salesByChannel(range),
    expenseTotals(range),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { type: { in: ['expense_product', 'expense_fixed'] }, ...range },
      _sum: { amount: true },
    }),
  ]);

  const totalExpenses = expenses.productCosts + expenses.fixedCosts;
  const profit = sales - totalExpenses;

  const topExpenses = byCategory
    .map((r) => ({ category: r.category ?? 'Uncategorized', amount: Number(r._sum.amount ?? 0) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  res.json({
    month,
    totalSales: sales,
    totalExpenses,
    profit,
    profitMargin: margin(profit, sales),
    salesByChannel: channels,
    topExpenses,
  });
}

export async function profitLossReport(req: Request, res: Response) {
  const { startDate, endDate } = rangeQuerySchema.parse(req.query);
  const range = dateRangeWhere(startDate, endDate);

  const [revenue, channels, expenses] = await Promise.all([
    totalSales(range),
    salesByChannel(range),
    expenseTotals(range),
  ]);

  const totalExpenses = expenses.productCosts + expenses.fixedCosts;
  const grossProfit = revenue - totalExpenses;

  res.json({
    period: `${startDate} → ${endDate}`,
    revenue,
    totalExpenses,
    grossProfit,
    profitMargin: margin(grossProfit, revenue),
    breakdown: {
      sales: {
        inStore: channels.in_store,
        foodpanda: channels.foodpanda,
        foodi: channels.foodi,
      },
      expenses: {
        productCosts: expenses.productCosts,
        fixedCosts: expenses.fixedCosts,
        other: 0,
      },
    },
  });
}

export async function customReport(req: Request, res: Response) {
  const { startDate, endDate } = rangeQuerySchema.parse(req.query);
  const range = dateRangeWhere(startDate, endDate);

  const [sales, methods, channels, expenses] = await Promise.all([
    totalSales(range),
    salesByMethod(range),
    salesByChannel(range),
    expenseTotals(range),
  ]);
  const totalExpenses = expenses.productCosts + expenses.fixedCosts;

  res.json({
    period: `${startDate} → ${endDate}`,
    totalSales: sales,
    totalExpenses,
    profit: sales - totalExpenses,
    salesByMethod: methods,
    salesByChannel: channels,
    expensesBreakdown: expenses,
  });
}

export async function productSalesReport(req: Request, res: Response) {
  const q = productSalesQuerySchema.parse(req.query);

  let startDate = q.startDate;
  let endDate = q.endDate;
  if (q.month) {
    startDate = `${q.month}-01`;
    endDate = businessMonthEndKey(q.month);
  } else if (!startDate && !endDate) {
    const currentMonth = todayBusinessKey().slice(0, 7);
    startDate = `${currentMonth}-01`;
    endDate = businessMonthEndKey(currentMonth);
  }
  const dateFilter = dateRangeWhere(startDate, endDate);
  const createdAtFilter = 'date' in dateFilter ? { createdAt: dateFilter.date } : {};

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        ...createdAtFilter,
        ...(q.posChannel ? { channel: q.posChannel } : {}),
        saleTransaction: { receiptStatus: 'completed' },
      },
      ...(q.menuItemId ? { menuItemId: q.menuItemId } : {}),
      ...(q.category ? { menuItem: { category: parseMenuCategory(q.category) } } : {}),
    },
    select: {
      menuItemId: true,
      nameSnapshot: true,
      quantity: true,
      unitPrice: true,
      isGift: true,
      menuItem: { select: { category: true } },
    },
  });

  interface ProductAgg {
    menuItemId: string | null;
    name: string;
    category: string;
    qtySold: number;
    qtyGifted: number;
    revenue: number;
  }

  const byProduct = new Map<string, ProductAgg>();

  for (const item of items) {
    const key = item.menuItemId ?? `name:${item.nameSnapshot}`;
    const qty = item.quantity;
    const lineRevenue = item.isGift ? 0 : Number(item.unitPrice) * qty;
    const category = item.menuItem ? serializeMenuCategory(item.menuItem.category) : 'Uncategorized';

    let agg = byProduct.get(key);
    if (!agg) {
      agg = {
        menuItemId: item.menuItemId,
        name: item.nameSnapshot,
        category,
        qtySold: 0,
        qtyGifted: 0,
        revenue: 0,
      };
      byProduct.set(key, agg);
    }

    agg.qtySold += qty;
    if (item.isGift) agg.qtyGifted += qty;
    agg.revenue += lineRevenue;
  }

  const totalRevenue = Array.from(byProduct.values()).reduce((sum, p) => sum + p.revenue, 0);

  const products = Array.from(byProduct.values())
    .map((p) => {
      const qtyPaid = p.qtySold - p.qtyGifted;
      return {
        menuItemId: p.menuItemId ?? undefined,
        name: p.name,
        category: p.category,
        qtySold: p.qtySold,
        qtyGifted: p.qtyGifted,
        revenue: Number(p.revenue.toFixed(2)),
        avgSellingPrice: qtyPaid > 0 ? Number((p.revenue / qtyPaid).toFixed(2)) : 0,
        percentOfTotalRevenue: totalRevenue > 0 ? Number(((p.revenue / totalRevenue) * 100).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalUnitsSold = products.reduce((sum, p) => sum + p.qtySold, 0);
  const byQtyDesc = [...products].sort((a, b) => b.qtySold - a.qtySold);
  const toSummaryEntry = (p: (typeof products)[number] | undefined) =>
    p ? { name: p.name, qtySold: p.qtySold, revenue: p.revenue } : null;

  res.json({
    period: { startDate, endDate },
    summary: {
      totalProducts: products.length,
      totalUnitsSold,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      bestSellingProduct: toSummaryEntry(byQtyDesc[0]),
      lowestSellingProduct: toSummaryEntry(byQtyDesc[byQtyDesc.length - 1]),
    },
    products,
  });
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportReport(req: Request, res: Response) {
  const q = exportQuerySchema.parse(req.query);
  const rows = await prisma.transaction.findMany({
    where: dateRangeWhere(q.startDate, q.endDate),
    orderBy: { date: 'desc' },
  });

  const data = rows.map(serializeTransaction);
  const headers = [
    'id',
    'date',
    'type',
    'category',
    'channel',
    'method',
    'description',
    'amount',
  ];
  const lines = [
    headers.join(','),
    ...data.map((t) =>
      [t.id, t.date, t.type, t.category, t.channel, t.method, t.description, t.amount]
        .map(csvCell)
        .join(','),
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="report-${q.type}-${Date.now()}.csv"`,
  );
  res.send(lines.join('\n'));
}
