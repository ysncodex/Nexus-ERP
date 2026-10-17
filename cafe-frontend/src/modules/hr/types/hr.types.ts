/**
 * HR domain types shared by Staff Schedule and Payroll.
 * Money on the client is integer paisa; the API service converts to/from Taka.
 */

export const ATTENDANCE = ['scheduled', 'present', 'late', 'absent', 'leave', 'cancelled'] as const;
export type Attendance = (typeof ATTENDANCE)[number];

export interface StaffMember {
  id: string;
  code?: string;
  name: string;
  role: string;
  active: boolean;
}

export type StaffInput = Pick<StaffMember, 'name' | 'role' | 'active'>;

export interface Shift {
  id: string;
  staffId: string;
  /** Business day, YYYY-MM-DD. */
  date: string;
  /** HH:mm */
  start: string;
  end: string;
  overnight: boolean;
  breakMinutes: number;
  status: Attendance;
  notes: string;
}

export type ShiftInput = Omit<Shift, 'id'>;

export const MONEY_FIELDS = ['basic', 'allowance', 'bonus', 'overtime', 'deductions'] as const;
export type MoneyField = (typeof MONEY_FIELDS)[number];
export type Amounts = Record<MoneyField, number>;

export type PaymentMethod = 'cash' | 'bank' | 'bkash';
export type PayrollStage = 'draft' | 'approved' | 'void';
export type PayrollStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'void';

export interface PayrollPayment {
  id: string;
  /** Paisa. */
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  /** False only for payments imported from the old browser-only payroll. */
  postedToLedger: boolean;
}

export interface PayrollRecord extends Amounts {
  id: string;
  code?: string;
  staffId: string;
  staffName: string;
  role: string;
  /** YYYY-MM */
  month: string;
  stage: PayrollStage;
  notes: string;
  payments: PayrollPayment[];
}

export interface PayrollDraftInput extends Amounts {
  staffId: string;
  month: string;
  notes: string;
}

export interface PayrollPaymentInput {
  /** Paisa. */
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string;
  /** Idempotency key so a double-submitted payment is only posted once. */
  requestId: string;
}

export interface HrStatus {
  staff: number;
  payroll: number;
  canImport: boolean;
}

export interface HrImportResult {
  staff: number;
  shifts: number;
  payroll: number;
  payments: number;
}

/** Body for POST /hr/import (Taka amounts). */
export interface HrImportPayload {
  staff: { legacyId: string; name: string; role: string; active: boolean }[];
  shifts: (Omit<Shift, 'id' | 'staffId'> & { staffLegacyId: string })[];
  payroll: (Amounts & {
    staffLegacyId: string;
    staffName: string;
    role: string;
    month: string;
    stage: PayrollStage;
    notes: string;
    payments: { amount: number; date: string; method: PaymentMethod; reference: string }[];
  })[];
}
