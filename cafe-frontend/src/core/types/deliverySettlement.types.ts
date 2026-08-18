/**
 * Delivery Platform Settlement Type Definitions
 * Foodpanda / Foodi income reconciliation — separate from the Transaction ledger.
 */
import type { FundAccountType } from './fund.types';

export type DeliveryPlatform = 'foodpanda' | 'foodi' | 'other';
export type SettlementStatus = 'pending' | 'received' | 'disputed';

export interface DeliverySettlement {
  id: string;
  code?: string;
  platform: DeliveryPlatform;
  platformOther?: string;
  settlementNumber?: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceDate: Date;
  grossAmount: number;
  commissionAmount: number;
  vatOnService: number;
  netAmount: number;
  netAmountReceived?: number;
  receivedDate?: Date;
  bankAccount?: FundAccountType;
  status: SettlementStatus;
  notes: string;
  /** Set only when bankAccount = "reserve" — internal transfer, not sales revenue. */
  fundMovementId?: string;
  /** Set when bankAccount = cash/bank/bkash — the received amount is posted as
   * a real sale Transaction so it counts in Dashboard/Reports/Order History. */
  saleTransactionId?: string;
  createdBy?: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliverySettlementFormData {
  platform: DeliveryPlatform;
  platformOther?: string;
  settlementNumber?: string;
  periodStart: string;
  periodEnd: string;
  invoiceDate: string;
  grossAmount: number;
  commissionAmount?: number;
  vatOnService?: number;
  netAmountReceived?: number;
  receivedDate?: string;
  bankAccount?: FundAccountType;
  status?: SettlementStatus;
  notes?: string;
}
