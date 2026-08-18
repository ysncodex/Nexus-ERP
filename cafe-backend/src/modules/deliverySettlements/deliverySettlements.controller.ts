import type { Request, Response } from 'express';
import {
  deliverySettlementCreateSchema,
  deliverySettlementUpdateSchema,
  deliverySettlementsListQuerySchema,
} from './deliverySettlements.schema.js';
import {
  createDeliverySettlement,
  deleteDeliverySettlement,
  getDeliverySettlement,
  listDeliverySettlements,
  updateDeliverySettlement,
} from './deliverySettlements.service.js';
import { serializeDeliverySettlement } from './deliverySettlements.serialize.js';

export async function listSettlements(req: Request, res: Response) {
  const query = deliverySettlementsListQuerySchema.parse(req.query);
  const rows = await listDeliverySettlements(query);
  res.json(rows.map(serializeDeliverySettlement));
}

export async function getSettlement(req: Request, res: Response) {
  const id = String(req.params.id);
  const settlement = await getDeliverySettlement(id);
  res.json(serializeDeliverySettlement(settlement));
}

export async function createSettlement(req: Request, res: Response) {
  const data = deliverySettlementCreateSchema.parse(req.body);
  const settlement = await createDeliverySettlement(data, req.user?.id);
  res.status(201).json(serializeDeliverySettlement(settlement));
}

export async function updateSettlement(req: Request, res: Response) {
  const id = String(req.params.id);
  const data = deliverySettlementUpdateSchema.parse(req.body);
  const settlement = await updateDeliverySettlement(id, data);
  res.json(serializeDeliverySettlement(settlement));
}

export async function deleteSettlement(req: Request, res: Response) {
  const id = String(req.params.id);
  await deleteDeliverySettlement(id);
  res.status(204).send();
}
