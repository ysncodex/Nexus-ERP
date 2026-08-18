import { api } from '../client';
import type {
  DeliverySettlement,
  DeliverySettlementFormData,
  DeliveryPlatform,
  SettlementStatus,
} from '@/core/types/deliverySettlement.types';

type ApiDeliverySettlement = Omit<
  DeliverySettlement,
  'periodStart' | 'periodEnd' | 'invoiceDate' | 'receivedDate' | 'createdAt' | 'updatedAt'
> & {
  periodStart: string;
  periodEnd: string;
  invoiceDate: string;
  receivedDate?: string;
  createdAt: string;
  updatedAt: string;
};

function parseSettlement(row: ApiDeliverySettlement): DeliverySettlement {
  return {
    ...row,
    periodStart: new Date(row.periodStart),
    periodEnd: new Date(row.periodEnd),
    invoiceDate: new Date(row.invoiceDate),
    receivedDate: row.receivedDate ? new Date(row.receivedDate) : undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export type DeliverySettlementUpdateData = Partial<DeliverySettlementFormData>;

export const deliverySettlementsService = {
  getAll: async (params?: {
    startDate?: string;
    endDate?: string;
    platform?: DeliveryPlatform;
    status?: SettlementStatus;
  }): Promise<DeliverySettlement[]> => {
    const rows = await api.get<ApiDeliverySettlement[]>('/delivery-settlements', params);
    return rows.map(parseSettlement);
  },

  getById: async (id: string): Promise<DeliverySettlement> => {
    const row = await api.get<ApiDeliverySettlement>(`/delivery-settlements/${id}`);
    return parseSettlement(row);
  },

  create: async (data: DeliverySettlementFormData): Promise<DeliverySettlement> => {
    const row = await api.post<ApiDeliverySettlement>('/delivery-settlements', data);
    return parseSettlement(row);
  },

  update: async (id: string, data: DeliverySettlementUpdateData): Promise<DeliverySettlement> => {
    const row = await api.put<ApiDeliverySettlement>(`/delivery-settlements/${id}`, data);
    return parseSettlement(row);
  },

  delete: async (id: string): Promise<void> => {
    return api.delete<void>(`/delivery-settlements/${id}`);
  },
};
