/**
 * Reader for the old browser-only Staff Schedule + Payroll data.
 * Used once to copy that data into the database, then the keys are removed.
 */
import {
  ATTENDANCE,
  MONEY_FIELDS,
  type Amounts,
  type Attendance,
  type HrImportPayload,
  type PaymentMethod,
  type PayrollStage,
} from '../types/hr.types';
import { validDate } from './roster';
import { validMonth } from './payroll';

export const LEGACY_ROSTER_KEY = 'nexus-erp.staff-roster.v1';
export const LEGACY_PAYROLL_KEY = 'nexus-erp.payroll.v1';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const METHODS: readonly PaymentMethod[] = ['cash', 'bank', 'bkash'];
const STAGES: readonly PayrollStage[] = ['draft', 'approved', 'void'];

export type LegacyHrRead =
  | { kind: 'none' }
  | { kind: 'error'; message: string; raw: string }
  | {
      kind: 'ready';
      payload: HrImportPayload;
      counts: { staff: number; shifts: number; payroll: number; payments: number };
      raw: string;
    };

function obj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseRoster(raw: string | null) {
  if (!raw) return { staff: [], shifts: [] };
  const data: unknown = JSON.parse(raw);
  if (!obj(data) || !Array.isArray(data.staff) || !Array.isArray(data.shifts))
    throw new Error('Saved staff schedule has an unknown format.');

  const staff: HrImportPayload['staff'] = data.staff.map((item: unknown) => {
    if (!obj(item) || typeof item.id !== 'string' || !str(item.name).trim())
      throw new Error('Saved staff schedule has an invalid staff record.');
    return {
      legacyId: item.id,
      name: str(item.name).trim().slice(0, 80),
      role: str(item.role).trim().slice(0, 80),
      active: item.active !== false,
    };
  });

  const shifts: HrImportPayload['shifts'] = data.shifts.map((item: unknown) => {
    if (
      !obj(item) ||
      typeof item.staffId !== 'string' ||
      !validDate(str(item.date)) ||
      !TIME_RE.test(str(item.start)) ||
      !TIME_RE.test(str(item.end))
    )
      throw new Error('Saved staff schedule has an invalid shift.');
    const status = ATTENDANCE.includes(item.status as Attendance)
      ? (item.status as Attendance)
      : 'scheduled';
    return {
      staffLegacyId: item.staffId,
      date: str(item.date),
      start: str(item.start),
      end: str(item.end),
      overnight: item.overnight === true,
      breakMinutes: Number.isInteger(item.breakMinutes) ? Number(item.breakMinutes) : 0,
      status,
      notes: str(item.notes).slice(0, 500),
    };
  });

  return { staff, shifts };
}

function parsePayroll(raw: string | null): HrImportPayload['payroll'] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!obj(data) || !Array.isArray(data.records))
    throw new Error('Saved payroll has an unknown format.');

  return data.records.map((item: unknown) => {
    if (
      !obj(item) ||
      typeof item.staffId !== 'string' ||
      !str(item.staffName).trim() ||
      !validMonth(str(item.month)) ||
      !STAGES.includes(item.stage as PayrollStage) ||
      !Array.isArray(item.payments)
    )
      throw new Error('Saved payroll has an invalid record.');

    const amounts = {} as Amounts;
    for (const key of MONEY_FIELDS) {
      const value = item[key];
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
        throw new Error('Saved payroll has an invalid amount.');
      amounts[key] = value / 100;
    }

    const payments = item.payments.map((payment: unknown) => {
      if (
        !obj(payment) ||
        typeof payment.amount !== 'number' ||
        !Number.isSafeInteger(payment.amount) ||
        payment.amount <= 0 ||
        !validDate(str(payment.date)) ||
        !METHODS.includes(payment.method as PaymentMethod)
      )
        throw new Error('Saved payroll has an invalid payment.');
      return {
        amount: payment.amount / 100,
        date: str(payment.date),
        method: payment.method as PaymentMethod,
        reference: str(payment.reference).slice(0, 120),
      };
    });

    return {
      ...amounts,
      staffLegacyId: item.staffId,
      staffName: str(item.staffName).trim().slice(0, 80),
      role: str(item.role).trim().slice(0, 80),
      month: str(item.month),
      stage: item.stage as PayrollStage,
      notes: str(item.notes).slice(0, 500),
      payments,
    };
  });
}

/** Read the old browser copy, if any. Never throws. */
export function readLegacyHr(): LegacyHrRead {
  let rosterRaw: string | null = null;
  let payrollRaw: string | null = null;
  try {
    rosterRaw = localStorage.getItem(LEGACY_ROSTER_KEY);
    payrollRaw = localStorage.getItem(LEGACY_PAYROLL_KEY);
  } catch {
    return { kind: 'none' };
  }
  if (!rosterRaw && !payrollRaw) return { kind: 'none' };

  const asJson = (value: string | null): unknown => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const raw = JSON.stringify(
    { [LEGACY_ROSTER_KEY]: asJson(rosterRaw), [LEGACY_PAYROLL_KEY]: asJson(payrollRaw) },
    null,
    2
  );

  try {
    const { staff, shifts } = parseRoster(rosterRaw);
    const payroll = parsePayroll(payrollRaw);
    if (!staff.length && !shifts.length && !payroll.length) return { kind: 'none' };
    return {
      kind: 'ready',
      payload: { staff, shifts, payroll },
      counts: {
        staff: staff.length,
        shifts: shifts.length,
        payroll: payroll.length,
        payments: payroll.reduce((sum, record) => sum + record.payments.length, 0),
      },
      raw,
    };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : 'Saved HR data could not be read.',
      raw,
    };
  }
}

export function clearLegacyHr() {
  localStorage.removeItem(LEGACY_ROSTER_KEY);
  localStorage.removeItem(LEGACY_PAYROLL_KEY);
}
