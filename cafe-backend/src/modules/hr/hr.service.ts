import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { businessDateKey, parseBusinessDate, todayBusinessKey } from '../../utils/businessDate.js';
import { assertSufficientFunds } from '../funds/funds.service.js';
import type {
  HrImportInput,
  PayrollCreateInput,
  PayrollPaymentInput,
  PayrollUpdateInput,
  ShiftCreateInput,
  ShiftUpdateInput,
  StaffCreateInput,
  StaffUpdateInput,
} from './hr.schema.js';

type Tx = Prisma.TransactionClient;

/** Fixed Expense catalog item every salary payment is filed under. */
export const SALARY_EXPENSE_ITEM = 'Salaries';
/** Same separator the Fixed Expenses page uses between item and note. */
const EXPENSE_NOTE_SEPARATOR = '\n[Note] ';
const MAX_SHIFT_RANGE_DAYS = 400;
const FUTURE_ATTENDANCE = new Set(['present', 'late', 'absent']);

const payrollInclude = {
  payments: { orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.PayrollRecordInclude;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Taka → integer paisa, so totals never accumulate floating-point error. */
function toPaisa(value: Prisma.Decimal | number): number {
  return Math.round(Number(value) * 100);
}

function fromPaisa(paisa: number): number {
  return paisa / 100;
}

function formatTaka(paisa: number): string {
  return `৳${(paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PayrollAmounts = {
  basic: Prisma.Decimal | number;
  allowance: Prisma.Decimal | number;
  bonus: Prisma.Decimal | number;
  overtime: Prisma.Decimal | number;
  deductions: Prisma.Decimal | number;
};

function netPaisa(record: PayrollAmounts): number {
  return (
    toPaisa(record.basic) +
    toPaisa(record.allowance) +
    toPaisa(record.bonus) +
    toPaisa(record.overtime) -
    toPaisa(record.deductions)
  );
}

function paidPaisa(payments: { amount: Prisma.Decimal | number }[]): number {
  return payments.reduce((sum, payment) => sum + toPaisa(payment.amount), 0);
}

function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function toMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function lockStaff(tx: Tx, staffId: string) {
  await tx.$queryRaw`SELECT id FROM staff_members WHERE id = ${staffId} FOR UPDATE`;
}

async function lockPayroll(tx: Tx, payrollId: string) {
  await tx.$queryRaw`SELECT id FROM payroll_records WHERE id = ${payrollId} FOR UPDATE`;
}

// ── Staff ────────────────────────────────────────────────────────────────────

export function listStaff() {
  return prisma.staffMember.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
}

export function createStaff(data: StaffCreateInput) {
  return prisma.staffMember.create({ data });
}

export async function updateStaff(id: string, data: StaffUpdateInput) {
  const existing = await prisma.staffMember.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Staff member not found');
  return prisma.staffMember.update({ where: { id }, data });
}

// ── Shifts ───────────────────────────────────────────────────────────────────

type ShiftCandidate = {
  id?: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  overnight: boolean;
  breakMinutes: number;
  status: ShiftCreateInput['status'];
};

function shiftRange(shift: Pick<ShiftCandidate, 'date' | 'start' | 'end' | 'overnight'>): [number, number] {
  const [y, m, d] = shift.date.split('-').map(Number);
  const dayStart = Date.UTC(y, m - 1, d) / 60_000;
  return [
    dayStart + toMinutes(shift.start),
    dayStart + toMinutes(shift.end) + (shift.overnight ? 1440 : 0),
  ];
}

/** Mirrors the rules the Staff Schedule page enforced locally, now on the server. */
async function assertValidShift(tx: Tx, shift: ShiftCandidate, previousStaffId?: string) {
  const staff = await tx.staffMember.findUnique({ where: { id: shift.staffId } });
  if (!staff) throw ApiError.badRequest('Choose a staff member.');
  if (!staff.active && previousStaffId !== staff.id) {
    throw ApiError.badRequest('Choose an active staff member for a new assignment.');
  }

  const duration = toMinutes(shift.end) - toMinutes(shift.start) + (shift.overnight ? 1440 : 0);
  if (duration <= 0 || duration > 1440) {
    throw ApiError.badRequest(
      'Shift duration must be more than zero and no longer than 24 hours. Check Ends next day.',
    );
  }
  if (shift.breakMinutes >= duration) {
    throw ApiError.badRequest('Break must be a whole number shorter than the shift duration.');
  }
  if (shift.date > todayBusinessKey() && FUTURE_ATTENDANCE.has(shift.status)) {
    throw ApiError.badRequest('Attendance cannot be recorded for a future date.');
  }

  if (shift.status === 'cancelled') return;

  const neighbours = await tx.staffShift.findMany({
    where: {
      staffId: shift.staffId,
      status: { not: 'cancelled' },
      shiftDate: {
        gte: parseBusinessDate(addDays(shift.date, -1)),
        lte: parseBusinessDate(addDays(shift.date, 1)),
      },
      ...(shift.id ? { id: { not: shift.id } } : {}),
    },
  });

  const [start, end] = shiftRange(shift);
  const overlaps = neighbours.some((other) => {
    const [otherStart, otherEnd] = shiftRange({
      date: businessDateKey(other.shiftDate),
      start: other.startTime,
      end: other.endTime,
      overnight: other.overnight,
    });
    return start < otherEnd && end > otherStart;
  });
  if (overlaps) {
    throw ApiError.conflict(
      'This staff member already has an overlapping shift or leave entry, including overnight hours.',
    );
  }
}

export function listShifts(query: { from: string; to: string }) {
  const spanDays =
    (parseBusinessDate(query.to).getTime() - parseBusinessDate(query.from).getTime()) / 86_400_000;
  if (spanDays > MAX_SHIFT_RANGE_DAYS) {
    throw ApiError.badRequest(`Choose a range of ${MAX_SHIFT_RANGE_DAYS} days or fewer.`);
  }

  return prisma.staffShift.findMany({
    where: { shiftDate: { gte: parseBusinessDate(query.from), lte: parseBusinessDate(query.to) } },
    orderBy: [{ shiftDate: 'asc' }, { startTime: 'asc' }],
  });
}

export function createShift(data: ShiftCreateInput) {
  return prisma.$transaction(async (tx) => {
    await lockStaff(tx, data.staffId);
    await assertValidShift(tx, data);
    return tx.staffShift.create({
      data: {
        staffId: data.staffId,
        shiftDate: parseBusinessDate(data.date),
        startTime: data.start,
        endTime: data.end,
        overnight: data.overnight,
        breakMinutes: data.breakMinutes,
        status: data.status,
        notes: data.notes,
      },
    });
  });
}

export function updateShift(id: string, data: ShiftUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.staffShift.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Shift not found');

    const merged: ShiftCandidate & { notes: string } = {
      id,
      staffId: data.staffId ?? existing.staffId,
      date: data.date ?? businessDateKey(existing.shiftDate),
      start: data.start ?? existing.startTime,
      end: data.end ?? existing.endTime,
      overnight: data.overnight ?? existing.overnight,
      breakMinutes: data.breakMinutes ?? existing.breakMinutes,
      status: data.status ?? existing.status,
      notes: data.notes ?? existing.notes,
    };

    await lockStaff(tx, merged.staffId);
    await assertValidShift(tx, merged, existing.staffId);

    return tx.staffShift.update({
      where: { id },
      data: {
        staffId: merged.staffId,
        shiftDate: parseBusinessDate(merged.date),
        startTime: merged.start,
        endTime: merged.end,
        overnight: merged.overnight,
        breakMinutes: merged.breakMinutes,
        status: merged.status,
        notes: merged.notes,
      },
    });
  });
}

// ── Payroll ──────────────────────────────────────────────────────────────────

const DUPLICATE_PAYROLL_MESSAGE =
  'This staff member already has payroll for this month. View the existing record.';

function assertPositiveNet(amounts: PayrollAmounts) {
  if (netPaisa(amounts) <= 0) {
    throw ApiError.badRequest('Net pay must be greater than zero. Check salary and deductions.');
  }
}

export function listPayroll(query: { month?: string }) {
  return prisma.payrollRecord.findMany({
    where: query.month ? { month: query.month } : {},
    include: payrollInclude,
    orderBy: [{ month: 'desc' }, { staffName: 'asc' }],
    take: query.month ? undefined : 2000,
  });
}

export async function getPayroll(id: string) {
  const record = await prisma.payrollRecord.findUnique({ where: { id }, include: payrollInclude });
  if (!record) throw ApiError.notFound('Payroll record not found');
  return record;
}

export async function createPayroll(data: PayrollCreateInput, userId?: string) {
  const staff = await prisma.staffMember.findUnique({ where: { id: data.staffId } });
  if (!staff) throw ApiError.badRequest('Choose a staff member.');
  if (!staff.active) throw ApiError.badRequest('Choose an active staff member for new payroll.');
  assertPositiveNet(data);

  try {
    return await prisma.payrollRecord.create({
      data: {
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        month: data.month,
        basic: data.basic,
        allowance: data.allowance,
        bonus: data.bonus,
        overtime: data.overtime,
        deductions: data.deductions,
        notes: data.notes,
        activeKey: `${staff.id}:${data.month}`,
        createdById: userId,
      },
      include: payrollInclude,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw ApiError.conflict(DUPLICATE_PAYROLL_MESSAGE);
    throw error;
  }
}

export async function updatePayroll(id: string, data: PayrollUpdateInput) {
  const existing = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Payroll record not found');
  if (existing.stage !== 'draft') {
    throw ApiError.conflict('Only draft payroll can be edited. Approved amounts are locked.');
  }

  const staffId = data.staffId ?? existing.staffId;
  const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!staff) throw ApiError.badRequest('Choose a staff member.');
  if (!staff.active && staffId !== existing.staffId) {
    throw ApiError.badRequest('Choose an active staff member for new payroll.');
  }

  const month = data.month ?? existing.month;
  const amounts = {
    basic: data.basic ?? existing.basic,
    allowance: data.allowance ?? existing.allowance,
    bonus: data.bonus ?? existing.bonus,
    overtime: data.overtime ?? existing.overtime,
    deductions: data.deductions ?? existing.deductions,
  };
  assertPositiveNet(amounts);

  try {
    const result = await prisma.payrollRecord.updateMany({
      where: { id, stage: 'draft' },
      data: {
        staffId,
        staffName: staff.name,
        staffRole: staff.role,
        month,
        ...amounts,
        notes: data.notes ?? existing.notes,
        activeKey: `${staffId}:${month}`,
      },
    });
    if (result.count === 0) {
      throw ApiError.conflict('Only draft payroll can be edited. Approved amounts are locked.');
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw ApiError.conflict(DUPLICATE_PAYROLL_MESSAGE);
    throw error;
  }

  return getPayroll(id);
}

export async function approvePayroll(id: string) {
  const existing = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Payroll record not found');
  if (existing.stage !== 'draft') throw ApiError.conflict('Only draft payroll can be approved.');
  assertPositiveNet(existing);

  const result = await prisma.payrollRecord.updateMany({
    where: { id, stage: 'draft' },
    data: { stage: 'approved', approvedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.conflict('Only draft payroll can be approved.');
  return getPayroll(id);
}

export async function voidPayroll(id: string) {
  await prisma.$transaction(async (tx) => {
    await lockPayroll(tx, id);
    const record = await tx.payrollRecord.findUnique({
      where: { id },
      include: { _count: { select: { payments: true } } },
    });
    if (!record) throw ApiError.notFound('Payroll record not found');
    if (record.stage === 'void') throw ApiError.conflict('This payroll is already void.');
    if (record._count.payments > 0) {
      throw ApiError.conflict('Reverse the recorded payments before voiding this payroll.');
    }

    await tx.payrollRecord.update({
      where: { id },
      data: { stage: 'void', voidedAt: new Date(), activeKey: null },
    });
  });
  return getPayroll(id);
}

async function salaryExpenseItem(tx: Tx) {
  const existing = await tx.fixedCostItem.findFirst({
    where: { name: { equals: SALARY_EXPENSE_ITEM, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return tx.fixedCostItem.upsert({
    where: { name: SALARY_EXPENSE_ITEM },
    create: { name: SALARY_EXPENSE_ITEM },
    update: {},
  });
}

/**
 * Record a salary payment and post it to the ledger as a Fixed Expense
 * ("Salaries") in one database transaction, so cash balances, Daily Summary,
 * and the P&L include it. A repeated `requestId` returns the first result.
 */
export async function recordPayrollPayment(id: string, data: PayrollPaymentInput, userId?: string) {
  if (data.requestId) {
    const duplicate = await prisma.payrollPayment.findUnique({ where: { requestId: data.requestId } });
    if (duplicate) {
      if (duplicate.payrollId !== id) throw ApiError.conflict('This payment request was already used.');
      return getPayroll(id);
    }
  }

  if (data.date > todayBusinessKey()) {
    throw ApiError.badRequest('Choose a valid payment date that is not in the future.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockPayroll(tx, id);
      const record = await tx.payrollRecord.findUnique({ where: { id }, include: { payments: true } });
      if (!record) throw ApiError.notFound('Payroll record not found');
      if (record.stage !== 'approved') {
        throw ApiError.conflict('Only approved payroll can receive a payment.');
      }

      const amountPaisa = toPaisa(data.amount);
      const duePaisa = Math.max(0, netPaisa(record) - paidPaisa(record.payments));
      if (amountPaisa <= 0) throw ApiError.badRequest('Enter a payment amount greater than zero.');
      if (amountPaisa > duePaisa) {
        throw ApiError.badRequest(
          `Payment cannot exceed the outstanding amount (${formatTaka(duePaisa)}).`,
        );
      }

      const amount = fromPaisa(amountPaisa);

      // A salary can't be paid from an account that doesn't hold the money —
      // the same guard the expense and fund-withdrawal write paths apply.
      await assertSufficientFunds(data.method, amount, tx, {
        what: 'this salary payment',
      });

      const paidOn = parseBusinessDate(data.date);
      const noteParts = [record.staffName, monthLabel(record.month), record.code ?? undefined];
      if (data.reference) noteParts.push(`Ref ${data.reference}`);
      const description = `${SALARY_EXPENSE_ITEM}${EXPENSE_NOTE_SEPARATOR}${noteParts.filter(Boolean).join(' · ')}`;

      const item = await salaryExpenseItem(tx);
      const expense = await tx.transaction.create({
        data: {
          type: 'expense_fixed',
          method: data.method,
          category: 'Fixed',
          description,
          amount,
          date: paidOn,
        },
      });
      await tx.fixedCostRecord.create({
        data: {
          transactionId: expense.id,
          fixedCostItemId: item.id,
          nameSnapshot: item.name,
          description,
          amount,
          paymentMethod: data.method,
          date: paidOn,
        },
      });
      await tx.payrollPayment.create({
        data: {
          payrollId: id,
          amount,
          paidOn,
          method: data.method,
          reference: data.reference,
          transactionId: expense.id,
          requestId: data.requestId,
          createdById: userId,
        },
      });
    });
  } catch (error) {
    // Two identical submissions raced; the first one won and nothing was posted twice.
    if (data.requestId && isUniqueViolation(error)) {
      const duplicate = await prisma.payrollPayment.findUnique({ where: { requestId: data.requestId } });
      if (duplicate?.payrollId === id) return getPayroll(id);
    }
    throw error;
  }

  return getPayroll(id);
}

/** Undo a payment: removes the payment and its Fixed Expense ledger entry together. */
export async function reversePayrollPayment(payrollId: string, paymentId: string) {
  await prisma.$transaction(async (tx) => {
    await lockPayroll(tx, payrollId);
    const payment = await tx.payrollPayment.findFirst({ where: { id: paymentId, payrollId } });
    if (!payment) throw ApiError.notFound('Payment not found');

    await tx.payrollPayment.delete({ where: { id: payment.id } });
    if (payment.transactionId) {
      await tx.fixedCostRecord.deleteMany({ where: { transactionId: payment.transactionId } });
      await tx.transaction.delete({ where: { id: payment.transactionId } });
    }
  });
  return getPayroll(payrollId);
}

/** Expense rows owned by payroll must be corrected from Payroll, not Fixed Expenses. */
export async function isPayrollLinkedTransaction(transactionId: string): Promise<boolean> {
  const link = await prisma.payrollPayment.findUnique({
    where: { transactionId },
    select: { id: true },
  });
  return link !== null;
}

// ── One-time import of the old browser-only data ─────────────────────────────

export async function hrStatus() {
  const [staff, payroll] = await Promise.all([
    prisma.staffMember.count(),
    prisma.payrollRecord.count(),
  ]);
  return { staff, payroll, canImport: staff === 0 && payroll === 0 };
}

/**
 * Copy Staff Schedule + Payroll data that used to live only in the browser.
 * Allowed once (empty HR tables). Imported payments are NOT posted to the
 * ledger, because the old Payroll page never created an expense for them.
 */
export async function importLegacyHr(data: HrImportInput, userId?: string) {
  return prisma.$transaction(
    async (tx) => {
      const [staffCount, payrollCount] = await Promise.all([
        tx.staffMember.count(),
        tx.payrollRecord.count(),
      ]);
      if (staffCount > 0 || payrollCount > 0) {
        throw ApiError.conflict('HR data already exists in the database. Import is only available once.');
      }

      const idMap = new Map<string, string>();
      for (const member of data.staff) {
        if (idMap.has(member.legacyId)) continue;
        const created = await tx.staffMember.create({
          data: { name: member.name, role: member.role, active: member.active },
        });
        idMap.set(member.legacyId, created.id);
      }

      for (const record of data.payroll) {
        if (idMap.has(record.staffLegacyId)) continue;
        const created = await tx.staffMember.create({
          data: { name: record.staffName, role: record.role, active: false },
        });
        idMap.set(record.staffLegacyId, created.id);
      }

      const shifts = data.shifts.map((shift, index) => {
        const staffId = idMap.get(shift.staffLegacyId);
        const duration = toMinutes(shift.end) - toMinutes(shift.start) + (shift.overnight ? 1440 : 0);
        if (!staffId || duration <= 0 || duration > 1440 || shift.breakMinutes >= duration) {
          throw ApiError.badRequest(`Shift ${index + 1} in the saved schedule is invalid.`);
        }
        return {
          staffId,
          shiftDate: parseBusinessDate(shift.date),
          startTime: shift.start,
          endTime: shift.end,
          overnight: shift.overnight,
          breakMinutes: shift.breakMinutes,
          status: shift.status,
          notes: shift.notes,
        };
      });
      if (shifts.length) await tx.staffShift.createMany({ data: shifts });

      const activeKeys = new Set<string>();
      let payments = 0;
      for (const [index, record] of data.payroll.entries()) {
        const staffId = idMap.get(record.staffLegacyId) as string;
        const paid = paidPaisa(record.payments);
        if (netPaisa(record) <= 0 || paid > netPaisa(record) || (record.stage !== 'approved' && paid > 0)) {
          throw ApiError.badRequest(`Payroll ${index + 1} in the saved data has invalid totals.`);
        }

        const activeKey = record.stage === 'void' ? null : `${staffId}:${record.month}`;
        if (activeKey) {
          if (activeKeys.has(activeKey)) {
            throw ApiError.badRequest(`Payroll ${index + 1} duplicates another month for the same staff.`);
          }
          activeKeys.add(activeKey);
        }

        await tx.payrollRecord.create({
          data: {
            staffId,
            staffName: record.staffName,
            staffRole: record.role,
            month: record.month,
            basic: record.basic,
            allowance: record.allowance,
            bonus: record.bonus,
            overtime: record.overtime,
            deductions: record.deductions,
            stage: record.stage,
            activeKey,
            notes: record.notes,
            approvedAt: record.stage === 'approved' ? new Date() : null,
            voidedAt: record.stage === 'void' ? new Date() : null,
            createdById: userId,
            payments: {
              create: record.payments.map((payment) => ({
                amount: payment.amount,
                paidOn: parseBusinessDate(payment.date),
                method: payment.method,
                reference: payment.reference,
                createdById: userId,
              })),
            },
          },
        });
        payments += record.payments.length;
      }

      return {
        staff: idMap.size,
        shifts: shifts.length,
        payroll: data.payroll.length,
        payments,
      };
    },
    { timeout: 60_000 },
  );
}
