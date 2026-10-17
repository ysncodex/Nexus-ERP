import { z } from 'zod';

export const ATTENDANCE = ['scheduled', 'present', 'late', 'absent', 'leave', 'cancelled'] as const;
export const PAYMENT_METHODS = ['cash', 'bank', 'bkash'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Matches Decimal(12,2) headroom and the old payroll limit (below 100,000,000 Taka). */
const MAX_AMOUNT = 99_999_999.99;

function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const dateKey = z.string().refine(isCalendarDate, 'Choose a valid date (YYYY-MM-DD).');
const timeKey = z.string().regex(TIME_RE, 'Enter a valid time (HH:mm).');
const monthKey = z.string().regex(MONTH_RE, 'Choose a valid payroll month (YYYY-MM).');

/** Taka with at most two decimal places. */
const money = z
  .number()
  .min(0, 'Amounts cannot be negative.')
  .max(MAX_AMOUNT, 'Amounts must be below 100,000,000 Taka.')
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: 'Use at most two decimal places.',
  });

const notes = z.string().trim().max(500, 'Notes must be 500 characters or fewer.');

// ── Staff ────────────────────────────────────────────────────────────────────

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  role: z.string().trim().max(80).default(''),
  active: z.boolean().default(true),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80).optional(),
  role: z.string().trim().max(80).optional(),
  active: z.boolean().optional(),
});

// ── Shifts ───────────────────────────────────────────────────────────────────

export const shiftCreateSchema = z.object({
  staffId: z.string().min(1, 'Choose a staff member.'),
  date: dateKey,
  start: timeKey,
  end: timeKey,
  overnight: z.boolean().default(false),
  breakMinutes: z.number().int('Break must be whole minutes.').min(0).max(1439).default(0),
  status: z.enum(ATTENDANCE).default('scheduled'),
  notes: notes.default(''),
});

export const shiftUpdateSchema = z.object({
  staffId: z.string().min(1).optional(),
  date: dateKey.optional(),
  start: timeKey.optional(),
  end: timeKey.optional(),
  overnight: z.boolean().optional(),
  breakMinutes: z.number().int('Break must be whole minutes.').min(0).max(1439).optional(),
  status: z.enum(ATTENDANCE).optional(),
  notes: notes.optional(),
});

export const shiftsListQuerySchema = z
  .object({ from: dateKey, to: dateKey })
  .refine((q) => q.from <= q.to, { message: '"from" must be on or before "to".', path: ['to'] });

// ── Payroll ──────────────────────────────────────────────────────────────────

const amounts = {
  basic: money.default(0),
  allowance: money.default(0),
  bonus: money.default(0),
  overtime: money.default(0),
  deductions: money.default(0),
};

export const payrollCreateSchema = z.object({
  staffId: z.string().min(1, 'Choose a staff member.'),
  month: monthKey,
  ...amounts,
  notes: notes.default(''),
});

export const payrollUpdateSchema = z.object({
  staffId: z.string().min(1).optional(),
  month: monthKey.optional(),
  basic: money.optional(),
  allowance: money.optional(),
  bonus: money.optional(),
  overtime: money.optional(),
  deductions: money.optional(),
  notes: notes.optional(),
});

export const payrollListQuerySchema = z.object({ month: monthKey.optional() });

export const payrollPaymentSchema = z.object({
  amount: money.refine((value) => value > 0, 'Enter a payment amount greater than zero.'),
  date: dateKey,
  method: z.enum(PAYMENT_METHODS, 'Choose a payment method.'),
  reference: z.string().trim().max(120, 'Reference must be 120 characters or fewer.').default(''),
  /** Client-generated id; repeating a request with the same id returns the first result. */
  requestId: z.string().trim().min(8).max(64).optional(),
});

// ── One-time import of the old browser-only data ─────────────────────────────

export const hrImportSchema = z.object({
  staff: z
    .array(
      z.object({
        legacyId: z.string().min(1).max(120),
        name: z.string().trim().min(1).max(80),
        role: z.string().trim().max(80).default(''),
        active: z.boolean().default(true),
      }),
    )
    .max(1000),
  shifts: z
    .array(
      z.object({
        staffLegacyId: z.string().min(1).max(120),
        date: dateKey,
        start: timeKey,
        end: timeKey,
        overnight: z.boolean().default(false),
        breakMinutes: z.number().int().min(0).max(1439).default(0),
        status: z.enum(ATTENDANCE).default('scheduled'),
        notes: notes.default(''),
      }),
    )
    .max(10000),
  payroll: z
    .array(
      z.object({
        staffLegacyId: z.string().min(1).max(120),
        staffName: z.string().trim().min(1).max(80),
        role: z.string().trim().max(80).default(''),
        month: monthKey,
        ...amounts,
        stage: z.enum(['draft', 'approved', 'void']),
        notes: notes.default(''),
        payments: z
          .array(
            z.object({
              amount: money.refine((value) => value > 0, 'Payment amount must be greater than zero.'),
              date: dateKey,
              method: z.enum(PAYMENT_METHODS),
              reference: z.string().trim().max(120).default(''),
            }),
          )
          .max(100)
          .default([]),
      }),
    )
    .max(5000),
});

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;
export type PayrollCreateInput = z.infer<typeof payrollCreateSchema>;
export type PayrollUpdateInput = z.infer<typeof payrollUpdateSchema>;
export type PayrollPaymentInput = z.infer<typeof payrollPaymentSchema>;
export type HrImportInput = z.infer<typeof hrImportSchema>;
