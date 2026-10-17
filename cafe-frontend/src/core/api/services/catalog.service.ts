import { api } from '../client';

export interface CatalogItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const catalogService = {
  getFixedItems: () => api.get<CatalogItem[]>('/expenses/catalog/fixed-items'),

  createFixedItem: (name: string) =>
    api.post<CatalogItem>('/expenses/catalog/fixed-items', { name }),

  renameFixedItem: (id: string, name: string) =>
    api.put<CatalogItem>(`/expenses/catalog/fixed-items/${id}`, { name }),

  deleteFixedItem: (id: string) => api.delete<void>(`/expenses/catalog/fixed-items/${id}`),

  getProductItems: () => api.get<CatalogItem[]>('/expenses/catalog/product-items'),

  createProductItem: (name: string) =>
    api.post<CatalogItem>('/expenses/catalog/product-items', { name }),

  renameProductItem: (id: string, name: string) =>
    api.put<CatalogItem>(`/expenses/catalog/product-items/${id}`, { name }),

  deleteProductItem: (id: string) => api.delete<void>(`/expenses/catalog/product-items/${id}`),

  getConsumableGroups: () => api.get<CatalogItem[]>('/expenses/catalog/consumable-groups'),

  createConsumableGroup: (name: string) =>
    api.post<CatalogItem>('/expenses/catalog/consumable-groups', { name }),

  renameConsumableGroup: (id: string, name: string) =>
    api.put<CatalogItem>(`/expenses/catalog/consumable-groups/${id}`, { name }),

  deleteConsumableGroup: (id: string) =>
    api.delete<void>(`/expenses/catalog/consumable-groups/${id}`),

  getConsumableItems: () => api.get<CatalogItem[]>('/expenses/catalog/consumable-items'),

  createConsumableItem: (name: string) =>
    api.post<CatalogItem>('/expenses/catalog/consumable-items', { name }),

  renameConsumableItem: (id: string, name: string) =>
    api.put<CatalogItem>(`/expenses/catalog/consumable-items/${id}`, { name }),

  deleteConsumableItem: (id: string) => api.delete<void>(`/expenses/catalog/consumable-items/${id}`),
};
