/**
 * HR module — Staff Schedule + Payroll (owner-only).
 *
 * Data lives in PostgreSQL behind `/api/hr` (see `core/api/services/hr.service.ts`).
 * Salary payments post a Fixed Expense ("Salaries") to the ledger, so cash
 * balances, Daily Summary, and the P&L include them.
 *
 *   pages/       Route screens (lazy-loaded by app/routes — import those paths directly)
 *   components/  Drawer, form field, register states, legacy import banner, styles
 *   types/       StaffMember, Shift, PayrollRecord, PayrollPayment …
 *   utils/       roster.ts (dates, hours, CSV), payroll.ts (paisa math, status, CSV),
 *                legacyHrStorage.ts (one-time move of old browser-only data),
 *                download.ts, apiError.ts
 */

export { default as StaffRoster } from './pages/StaffRoster';
export { default as Payroll } from './pages/Payroll';

export { ATTENDANCE, MONEY_FIELDS } from './types/hr.types';
export type {
  Amounts,
  Attendance,
  HrImportPayload,
  HrImportResult,
  HrStatus,
  MoneyField,
  PaymentMethod,
  PayrollDraftInput,
  PayrollPayment,
  PayrollPaymentInput,
  PayrollRecord,
  PayrollStage,
  PayrollStatus,
  Shift,
  ShiftInput,
  StaffInput,
  StaffMember,
} from './types/hr.types';

export { rosterCSV, shiftFormError, shiftMinutes, weekStart } from './utils/roster';
export { due, gross, net, paid, payrollCSV, payrollStatus, taka } from './utils/payroll';
export { LEGACY_PAYROLL_KEY, LEGACY_ROSTER_KEY, readLegacyHr } from './utils/legacyHrStorage';
