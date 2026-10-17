import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { catalogNameSchema, catalogRenameSchema } from './catalog.schema.js';
import {
  deleteConsumableGroup,
  deleteConsumableItem,
  deleteFixedCostItem,
  deleteProductCostItem,
  ensureConsumableGroup,
  ensureConsumableItem,
  ensureFixedCostItem,
  ensureProductCostItem,
  listConsumableGroups,
  listConsumableItems,
  listFixedCostItems,
  listProductCostItems,
  renameConsumableGroup,
  renameConsumableItem,
  renameFixedCostItem,
  renameProductCostItem,
} from './catalog.service.js';

function serializeCatalogItem(item: { id: string; name: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listFixedCostItemCatalog(_req: Request, res: Response) {
  const rows = await listFixedCostItems();
  res.json(rows.map(serializeCatalogItem));
}

export async function createFixedCostItemCatalog(req: Request, res: Response) {
  const { name } = catalogNameSchema.parse(req.body);
  const item = await ensureFixedCostItem(name);
  res.status(201).json(serializeCatalogItem(item));
}

export async function renameFixedCostItemCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  const { name } = catalogRenameSchema.parse(req.body);
  try {
    const item = await renameFixedCostItem(id, name);
    res.json(serializeCatalogItem(item));
  } catch {
    throw ApiError.notFound('Fixed cost item not found');
  }
}

export async function deleteFixedCostItemCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  try {
    await deleteFixedCostItem(id);
    res.status(204).send();
  } catch {
    throw ApiError.notFound('Fixed cost item not found');
  }
}

export async function listProductCostItemCatalog(_req: Request, res: Response) {
  const rows = await listProductCostItems();
  res.json(rows.map(serializeCatalogItem));
}

export async function createProductCostItemCatalog(req: Request, res: Response) {
  const { name } = catalogNameSchema.parse(req.body);
  const item = await ensureProductCostItem(name);
  res.status(201).json(serializeCatalogItem(item));
}

export async function renameProductCostItemCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  const { name } = catalogRenameSchema.parse(req.body);
  try {
    const item = await renameProductCostItem(id, name);
    res.json(serializeCatalogItem(item));
  } catch {
    throw ApiError.notFound('Product cost item not found');
  }
}

export async function listConsumableItemCatalog(_req: Request, res: Response) {
  const rows = await listConsumableItems();
  res.json(rows.map(serializeCatalogItem));
}

export async function createConsumableItemCatalog(req: Request, res: Response) {
  const { name } = catalogNameSchema.parse(req.body);
  const item = await ensureConsumableItem(name);
  res.status(201).json(serializeCatalogItem(item));
}

export async function renameConsumableItemCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  const { name } = catalogRenameSchema.parse(req.body);
  try {
    const item = await renameConsumableItem(id, name);
    res.json(serializeCatalogItem(item));
  } catch {
    throw ApiError.notFound('Consumable item not found');
  }
}

export async function deleteConsumableItemCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  try {
    await deleteConsumableItem(id);
    res.status(204).send();
  } catch {
    throw ApiError.notFound('Consumable item not found');
  }
}

export async function deleteProductCostItemCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  try {
    await deleteProductCostItem(id);
    res.status(204).send();
  } catch {
    throw ApiError.notFound('Product cost item not found');
  }
}

export async function listConsumableGroupCatalog(_req: Request, res: Response) {
  const rows = await listConsumableGroups();
  res.json(rows.map(serializeCatalogItem));
}

export async function createConsumableGroupCatalog(req: Request, res: Response) {
  const { name } = catalogNameSchema.parse(req.body);
  const group = await ensureConsumableGroup(name);
  res.status(201).json(serializeCatalogItem(group));
}

export async function renameConsumableGroupCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  const { name } = catalogRenameSchema.parse(req.body);
  try {
    const group = await renameConsumableGroup(id, name);
    res.json(serializeCatalogItem(group));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') throw ApiError.notFound('Consumable group not found');
    if (code === 'DUPLICATE') throw ApiError.conflict((error as Error).message);
    throw error;
  }
}

export async function deleteConsumableGroupCatalog(req: Request, res: Response) {
  const id = String(req.params.id);
  try {
    await deleteConsumableGroup(id);
    res.status(204).send();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') throw ApiError.notFound('Consumable group not found');
    throw error;
  }
}
