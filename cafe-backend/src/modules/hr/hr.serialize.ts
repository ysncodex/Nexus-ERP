import type {
  PayrollPayment,
  PayrollRecord,
  StaffMember,
  StaffShift,
} from '../../generated/prisma/client.js';
import { businessDateKey } from '../../utils/businessDate.js';

export function serializeStaff(staff: StaffMember) {
  return {
    id: staff.id,
    code: staff.code ?? undefined,
    name: staff.name,
    role: staff.role,
    active: staff.active,
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
  };
}

export function serializeShift(shift: StaffShift) {
  return {
    id: shift.id,
    staffId: shift.staffId,
    date: businessDateKey(shift.shiftDate),
    start: shift.startTime,
    end: shift.endTime,
    overnight: shift.overnight,
    breakMinutes: shift.breakMinutes,
    status: shift.status,
    notes: shift.notes,
    updatedAt: shift.updatedAt.toISOString(),
  };
}

export function serializePayrollPayment(payment: PayrollPayment) {
  return {
    id: payment.id,
    amount: Number(payment.amount),
    date: businessDateKey(payment.paidOn),
    method: payment.method,
    reference: payment.reference,
    transactionId: payment.transactionId ?? undefined,
    postedToLedger: payment.transactionId !== null,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function serializePayroll(record: PayrollRecord & { payments: PayrollPayment[] }) {
  return {
    id: record.id,
    code: record.code ?? undefined,
    staffId: record.staffId,
    staffName: record.staffName,
    role: record.staffRole,
    month: record.month,
    basic: Number(record.basic),
    allowance: Number(record.allowance),
    bonus: Number(record.bonus),
    overtime: Number(record.overtime),
    deductions: Number(record.deductions),
    stage: record.stage,
    notes: record.notes,
    approvedAt: record.approvedAt?.toISOString(),
    voidedAt: record.voidedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    payments: record.payments.map(serializePayrollPayment),
  };
}
