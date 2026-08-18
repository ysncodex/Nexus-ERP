import type {
  DeliverySettlement,
  FundMovement,
  Transaction,
  User,
} from '../../generated/prisma/client.js';

type DeliverySettlementWithRelations = DeliverySettlement & {
  fundMovement?: FundMovement | null;
  saleTransaction?: Transaction | null;
  createdBy?: Pick<User, 'id' | 'name'> | null;
};

export function serializeDeliverySettlement(settlement: DeliverySettlementWithRelations) {
  return {
    id: settlement.id,
    code: settlement.code ?? undefined,
    platform: settlement.platform,
    platformOther: settlement.platformOther ?? undefined,
    settlementNumber: settlement.settlementNumber ?? undefined,
    periodStart: settlement.periodStart.toISOString(),
    periodEnd: settlement.periodEnd.toISOString(),
    invoiceDate: settlement.invoiceDate.toISOString(),
    grossAmount: Number(settlement.grossAmount),
    commissionAmount: Number(settlement.commissionAmount),
    vatOnService: Number(settlement.vatOnService),
    netAmount: Number(settlement.netAmount),
    netAmountReceived:
      settlement.netAmountReceived !== null ? Number(settlement.netAmountReceived) : undefined,
    receivedDate: settlement.receivedDate ? settlement.receivedDate.toISOString() : undefined,
    bankAccount: settlement.bankAccount ?? undefined,
    status: settlement.status,
    notes: settlement.notes,
    fundMovementId: settlement.fundMovementId ?? undefined,
    saleTransactionId: settlement.saleTransactionId ?? undefined,
    createdBy: settlement.createdBy
      ? { id: settlement.createdBy.id, name: settlement.createdBy.name }
      : undefined,
    createdAt: settlement.createdAt.toISOString(),
    updatedAt: settlement.updatedAt.toISOString(),
  };
}
