import {
  MONEY_FIELDS,
  type Amounts,
  type PayrollRecord,
  type PayrollStatus,
} from '../types/hr.types';
import { toCsv } from './download';

export function validMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900;
}

export function moveMonth(value: string, by: number): string {
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(value: string): string {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/** Parse a typed Taka amount into integer paisa; null when invalid. */
export function toPaisa(value: string): number | null {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function taka(paisa: number): string {
  return `${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ৳`;
}

export function gross(record: Amounts): number {
  return record.basic + record.allowance + record.bonus + record.overtime;
}

export function net(record: Amounts): number {
  return gross(record) - record.deductions;
}

export function paid(record: PayrollRecord): number {
  return record.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function due(record: PayrollRecord): number {
  if (record.stage === 'void') return 0;
  return Math.max(0, net(record) - paid(record));
}

export function payrollStatus(record: PayrollRecord): PayrollStatus {
  if (record.stage === 'void' || record.stage === 'draft') return record.stage;
  return due(record) === 0 ? 'paid' : paid(record) > 0 ? 'partial' : 'unpaid';
}

export const METHOD_LABELS = { cash: 'Cash', bank: 'Bank', bkash: 'bKash' } as const;

export function payrollCSV(records: PayrollRecord[]): string {
  return toCsv([
    [
      'Payroll ID',
      'Month',
      'Staff',
      'Role',
      'Basic BDT',
      'Allowance BDT',
      'Bonus BDT',
      'Overtime BDT',
      'Deductions BDT',
      'Gross BDT',
      'Net BDT',
      'Paid BDT',
      'Due BDT',
      'Status',
      'Notes',
    ],
    ...records.map((r) => [
      r.code ?? '',
      r.month,
      r.staffName,
      r.role,
      ...MONEY_FIELDS.map((key) => (r[key] / 100).toFixed(2)),
      (gross(r) / 100).toFixed(2),
      (net(r) / 100).toFixed(2),
      (paid(r) / 100).toFixed(2),
      (due(r) / 100).toFixed(2),
      payrollStatus(r),
      r.notes,
    ]),
  ]);
}
