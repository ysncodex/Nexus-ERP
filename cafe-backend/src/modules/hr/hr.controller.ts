import type { Request, Response } from 'express';
import {
  hrImportSchema,
  payrollCreateSchema,
  payrollListQuerySchema,
  payrollPaymentSchema,
  payrollUpdateSchema,
  shiftCreateSchema,
  shiftsListQuerySchema,
  shiftUpdateSchema,
  staffCreateSchema,
  staffUpdateSchema,
} from './hr.schema.js';
import * as hr from './hr.service.js';
import { serializePayroll, serializeShift, serializeStaff } from './hr.serialize.js';

export async function getStatus(_req: Request, res: Response) {
  res.json(await hr.hrStatus());
}

// ── Staff ────────────────────────────────────────────────────────────────────

export async function listStaff(_req: Request, res: Response) {
  const rows = await hr.listStaff();
  res.json(rows.map(serializeStaff));
}

export async function createStaff(req: Request, res: Response) {
  const data = staffCreateSchema.parse(req.body);
  res.status(201).json(serializeStaff(await hr.createStaff(data)));
}

export async function updateStaff(req: Request, res: Response) {
  const data = staffUpdateSchema.parse(req.body);
  res.json(serializeStaff(await hr.updateStaff(String(req.params.id), data)));
}

// ── Shifts ───────────────────────────────────────────────────────────────────

export async function listShifts(req: Request, res: Response) {
  const query = shiftsListQuerySchema.parse(req.query);
  const rows = await hr.listShifts(query);
  res.json(rows.map(serializeShift));
}

export async function createShift(req: Request, res: Response) {
  const data = shiftCreateSchema.parse(req.body);
  res.status(201).json(serializeShift(await hr.createShift(data)));
}

export async function updateShift(req: Request, res: Response) {
  const data = shiftUpdateSchema.parse(req.body);
  res.json(serializeShift(await hr.updateShift(String(req.params.id), data)));
}

// ── Payroll ──────────────────────────────────────────────────────────────────

export async function listPayroll(req: Request, res: Response) {
  const query = payrollListQuerySchema.parse(req.query);
  const rows = await hr.listPayroll(query);
  res.json(rows.map(serializePayroll));
}

export async function getPayroll(req: Request, res: Response) {
  res.json(serializePayroll(await hr.getPayroll(String(req.params.id))));
}

export async function createPayroll(req: Request, res: Response) {
  const data = payrollCreateSchema.parse(req.body);
  res.status(201).json(serializePayroll(await hr.createPayroll(data, req.user?.id)));
}

export async function updatePayroll(req: Request, res: Response) {
  const data = payrollUpdateSchema.parse(req.body);
  res.json(serializePayroll(await hr.updatePayroll(String(req.params.id), data)));
}

export async function approvePayroll(req: Request, res: Response) {
  res.json(serializePayroll(await hr.approvePayroll(String(req.params.id))));
}

export async function voidPayroll(req: Request, res: Response) {
  res.json(serializePayroll(await hr.voidPayroll(String(req.params.id))));
}

export async function recordPayment(req: Request, res: Response) {
  const data = payrollPaymentSchema.parse(req.body);
  const record = await hr.recordPayrollPayment(String(req.params.id), data, req.user?.id);
  res.status(201).json(serializePayroll(record));
}

export async function reversePayment(req: Request, res: Response) {
  const record = await hr.reversePayrollPayment(
    String(req.params.id),
    String(req.params.paymentId),
  );
  res.json(serializePayroll(record));
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function importLegacy(req: Request, res: Response) {
  const data = hrImportSchema.parse(req.body);
  res.status(201).json(await hr.importLegacyHr(data, req.user?.id));
}
