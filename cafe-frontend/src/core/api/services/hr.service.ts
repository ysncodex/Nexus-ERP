import { api } from '../client';
import {
  MONEY_FIELDS,
  type Amounts,
  type HrImportPayload,
  type HrImportResult,
  type HrStatus,
  type PayrollDraftInput,
  type PayrollPayment,
  type PayrollPaymentInput,
  type PayrollRecord,
  type Shift,
  type ShiftInput,
  type StaffInput,
  type StaffMember,
} from '@/modules/hr/types/hr.types';

/** API amounts are Taka (2 dp); the HR pages work in integer paisa. */
const toPaisa = (taka: number) => Math.round(taka * 100);
const toTaka = (paisa: number) => paisa / 100;

type ApiPayment = PayrollPayment;
type ApiPayroll = PayrollRecord;

function amountsToTaka(amounts: Amounts): Amounts {
  return Object.fromEntries(MONEY_FIELDS.map((key) => [key, toTaka(amounts[key])])) as Amounts;
}

function parsePayment(row: ApiPayment): PayrollPayment {
  return {
    id: row.id,
    amount: toPaisa(row.amount),
    date: row.date,
    method: row.method,
    reference: row.reference,
    postedToLedger: row.postedToLedger,
  };
}

function parsePayroll(row: ApiPayroll): PayrollRecord {
  return {
    id: row.id,
    code: row.code,
    staffId: row.staffId,
    staffName: row.staffName,
    role: row.role,
    month: row.month,
    stage: row.stage,
    notes: row.notes,
    basic: toPaisa(row.basic),
    allowance: toPaisa(row.allowance),
    bonus: toPaisa(row.bonus),
    overtime: toPaisa(row.overtime),
    deductions: toPaisa(row.deductions),
    payments: row.payments.map(parsePayment),
  };
}

function parseStaff(row: StaffMember): StaffMember {
  return { id: row.id, code: row.code, name: row.name, role: row.role, active: row.active };
}

function parseShift(row: Shift): Shift {
  return {
    id: row.id,
    staffId: row.staffId,
    date: row.date,
    start: row.start,
    end: row.end,
    overnight: row.overnight,
    breakMinutes: row.breakMinutes,
    status: row.status,
    notes: row.notes,
  };
}

export const hrService = {
  getStatus: () => api.get<HrStatus>('/hr/status'),

  importLegacy: (payload: HrImportPayload) => api.post<HrImportResult>('/hr/import', payload),

  // ── Staff ──
  listStaff: async (): Promise<StaffMember[]> =>
    (await api.get<StaffMember[]>('/hr/staff')).map(parseStaff),

  createStaff: async (data: StaffInput): Promise<StaffMember> =>
    parseStaff(await api.post<StaffMember>('/hr/staff', data)),

  updateStaff: async (id: string, data: Partial<StaffInput>): Promise<StaffMember> =>
    parseStaff(await api.put<StaffMember>(`/hr/staff/${id}`, data)),

  // ── Shifts ──
  listShifts: async (from: string, to: string): Promise<Shift[]> =>
    (await api.get<Shift[]>('/hr/shifts', { from, to })).map(parseShift),

  createShift: async (data: ShiftInput): Promise<Shift> =>
    parseShift(await api.post<Shift>('/hr/shifts', data)),

  updateShift: async (id: string, data: Partial<ShiftInput>): Promise<Shift> =>
    parseShift(await api.put<Shift>(`/hr/shifts/${id}`, data)),

  // ── Payroll ──
  listPayroll: async (month: string): Promise<PayrollRecord[]> =>
    (await api.get<ApiPayroll[]>('/hr/payroll', { month })).map(parsePayroll),

  createPayroll: async (data: PayrollDraftInput): Promise<PayrollRecord> =>
    parsePayroll(
      await api.post<ApiPayroll>('/hr/payroll', {
        staffId: data.staffId,
        month: data.month,
        notes: data.notes,
        ...amountsToTaka(data),
      })
    ),

  updatePayroll: async (id: string, data: PayrollDraftInput): Promise<PayrollRecord> =>
    parsePayroll(
      await api.put<ApiPayroll>(`/hr/payroll/${id}`, {
        staffId: data.staffId,
        month: data.month,
        notes: data.notes,
        ...amountsToTaka(data),
      })
    ),

  approvePayroll: async (id: string): Promise<PayrollRecord> =>
    parsePayroll(await api.post<ApiPayroll>(`/hr/payroll/${id}/approve`)),

  voidPayroll: async (id: string): Promise<PayrollRecord> =>
    parsePayroll(await api.post<ApiPayroll>(`/hr/payroll/${id}/void`)),

  /** Posts a Fixed Expense ("Salaries") in the same database transaction. */
  recordPayment: async (id: string, data: PayrollPaymentInput): Promise<PayrollRecord> =>
    parsePayroll(
      await api.post<ApiPayroll>(`/hr/payroll/${id}/payments`, {
        ...data,
        amount: toTaka(data.amount),
      })
    ),

  /** Removes the payment and its Fixed Expense ledger entry together. */
  reversePayment: async (id: string, paymentId: string): Promise<PayrollRecord> =>
    parsePayroll(await api.delete<ApiPayroll>(`/hr/payroll/${id}/payments/${paymentId}`)),
};
