import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseBusinessDate } from '../../utils/businessDate.js';
import { dateRangeWhere, paginate } from '../../utils/query.js';
import { createFundMovement, deleteFundMovement } from '../funds/funds.service.js';
import type {
  DeliveryPlatform,
  FundAccountType,
  PaymentMethod,
  SalesChannel,
  SettlementStatus,
} from '../../generated/prisma/enums.js';
import type {
  DeliverySettlementCreateInput,
  DeliverySettlementUpdateInput,
} from './deliverySettlements.schema.js';

const settlementInclude = {
  fundMovement: true,
  saleTransaction: true,
  createdBy: { select: { id: true, name: true } },
} as const;

const PLATFORM_LABELS: Record<DeliveryPlatform, string> = {
  foodpanda: 'Foodpanda',
  foodi: 'Foodi',
  other: 'Other',
};

/** Reserve Fund isn't a real sales payment method — deposits there stay a
 * pure internal fund movement and are intentionally excluded from Sales
 * dashboards/reports. Every other account maps 1:1 onto PaymentMethod. */
function isCashLikeAccount(account: FundAccountType): account is PaymentMethod {
  return account !== 'reserve';
}

function mapPlatformToChannel(platform: DeliveryPlatform): SalesChannel | null {
  if (platform === 'foodpanda') return 'foodpanda';
  if (platform === 'foodi') return 'foodi';
  return null;
}

function computeNetAmount(gross: number, commission: number, deductions: number) {
  return Math.max(0, gross - commission - deductions);
}

function platformLabel(platform: DeliveryPlatform, platformOther?: string | null) {
  return platform === 'other' ? platformOther?.trim() || 'Other' : PLATFORM_LABELS[platform];
}

function settlementDescription(params: {
  platform: DeliveryPlatform;
  platformOther?: string | null;
  settlementNumber?: string | null;
  periodStart: string;
  periodEnd: string;
}) {
  const period = `${params.periodStart.slice(0, 10)} → ${params.periodEnd.slice(0, 10)}`;
  const numberSuffix = params.settlementNumber ? ` #${params.settlementNumber}` : '';
  return `${platformLabel(params.platform, params.platformOther)} settlement${numberSuffix} · ${period}`;
}

interface ReceivedInputs {
  platform: DeliveryPlatform;
  platformOther?: string | null;
  settlementNumber?: string | null;
  periodStart: string;
  periodEnd: string;
  invoiceDate: string;
  bankAccount: FundAccountType;
  netAmountReceived: number;
  receivedDate?: string;
}

interface ReceivedLinks {
  fundMovementId: string | null;
  saleTransactionId: string | null;
}

/**
 * Create the linked record for a "received" settlement.
 * - cash/bank/bkash → a real sale Transaction, so the deposit counts as
 *   revenue everywhere the ledger is already read (Dashboard, Reports, Order
 *   History) with no per-screen wiring.
 * - reserve → the previous FundMovement path (internal savings, not revenue).
 */
async function recordReceived(data: ReceivedInputs, createdById?: string): Promise<ReceivedLinks> {
  if (isCashLikeAccount(data.bankAccount)) {
    const tx = await prisma.transaction.create({
      data: {
        type: 'sale',
        amount: data.netAmountReceived,
        method: data.bankAccount,
        channel: mapPlatformToChannel(data.platform),
        description: settlementDescription(data),
        date: parseBusinessDate(data.receivedDate ?? data.invoiceDate),
        receiptStatus: 'completed',
        orderNumber: data.settlementNumber ? `STL-${data.settlementNumber}` : undefined,
        posChannel: 'delivery',
        category: `${platformLabel(data.platform, data.platformOther)} Settlement`,
      },
    });
    return { fundMovementId: null, saleTransactionId: tx.id };
  }

  const movement = await createFundMovement(
    {
      movementType: 'add',
      toAccount: data.bankAccount,
      amount: data.netAmountReceived,
      date: data.receivedDate ?? data.invoiceDate,
      notes: settlementDescription(data),
    },
    createdById
  );
  return { fundMovementId: movement.id, saleTransactionId: null };
}

async function reverseReceived(links: ReceivedLinks) {
  if (links.fundMovementId) await deleteFundMovement(links.fundMovementId);
  if (links.saleTransactionId) {
    await prisma.transaction.delete({ where: { id: links.saleTransactionId } }).catch(() => {});
  }
}

export async function createDeliverySettlement(
  data: DeliverySettlementCreateInput,
  createdById?: string
) {
  const grossAmount = data.grossAmount;
  const commissionAmount = data.commissionAmount ?? 0;
  const vatOnService = data.vatOnService ?? 0;
  const netAmount = computeNetAmount(grossAmount, commissionAmount, vatOnService);
  const status: SettlementStatus =
    data.status ?? (data.netAmountReceived !== undefined ? 'received' : 'pending');
  const isReceived = status === 'received';

  let links: ReceivedLinks = { fundMovementId: null, saleTransactionId: null };
  if (isReceived) {
    links = await recordReceived(
      {
        platform: data.platform,
        platformOther: data.platformOther,
        settlementNumber: data.settlementNumber,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        invoiceDate: data.invoiceDate,
        bankAccount: data.bankAccount!,
        netAmountReceived: data.netAmountReceived!,
        receivedDate: data.receivedDate,
      },
      createdById
    );
  }

  try {
    return await prisma.deliverySettlement.create({
      data: {
        platform: data.platform,
        platformOther: data.platform === 'other' ? data.platformOther?.trim() || null : null,
        settlementNumber: data.settlementNumber?.trim() || null,
        periodStart: parseBusinessDate(data.periodStart),
        periodEnd: parseBusinessDate(data.periodEnd),
        invoiceDate: parseBusinessDate(data.invoiceDate),
        grossAmount,
        commissionAmount,
        vatOnService,
        netAmount,
        netAmountReceived: isReceived ? data.netAmountReceived : null,
        receivedDate: isReceived
          ? parseBusinessDate(data.receivedDate ?? data.invoiceDate)
          : null,
        bankAccount: isReceived ? data.bankAccount : null,
        status,
        notes: data.notes?.trim() ?? '',
        fundMovementId: links.fundMovementId,
        saleTransactionId: links.saleTransactionId,
        createdById: createdById ?? null,
      },
      include: settlementInclude,
    });
  } catch (error) {
    // Roll back the linked record if the settlement row itself failed to save.
    await reverseReceived(links).catch(() => {});
    throw error;
  }
}

export async function updateDeliverySettlement(id: string, data: DeliverySettlementUpdateInput) {
  const existing = await prisma.deliverySettlement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Settlement not found');

  const platform = data.platform ?? existing.platform;
  const platformOther =
    data.platformOther !== undefined ? data.platformOther : existing.platformOther ?? undefined;
  const settlementNumber =
    data.settlementNumber !== undefined ? data.settlementNumber : existing.settlementNumber ?? undefined;
  const periodStart = data.periodStart ?? existing.periodStart.toISOString();
  const periodEnd = data.periodEnd ?? existing.periodEnd.toISOString();
  const invoiceDate = data.invoiceDate ?? existing.invoiceDate.toISOString();
  const grossAmount = data.grossAmount ?? Number(existing.grossAmount);
  const commissionAmount = data.commissionAmount ?? Number(existing.commissionAmount);
  const vatOnService = data.vatOnService ?? Number(existing.vatOnService);
  const netAmount = computeNetAmount(grossAmount, commissionAmount, vatOnService);

  const nextStatus: SettlementStatus = data.status ?? existing.status;
  const wasReceived = existing.status === 'received';
  const willBeReceived = nextStatus === 'received';

  const nextNetAmountReceived = data.netAmountReceived ?? (
    wasReceived ? Number(existing.netAmountReceived ?? 0) : undefined
  );
  const nextBankAccount = data.bankAccount ?? (wasReceived ? existing.bankAccount ?? undefined : undefined);
  const nextReceivedDate = data.receivedDate ?? (
    wasReceived ? existing.receivedDate?.toISOString() : undefined
  );

  const receivedInputsChanged =
    data.netAmountReceived !== undefined ||
    data.bankAccount !== undefined ||
    data.receivedDate !== undefined;

  let links: ReceivedLinks = {
    fundMovementId: existing.fundMovementId,
    saleTransactionId: existing.saleTransactionId,
  };

  if (wasReceived && !willBeReceived) {
    // Received → pending/disputed: reverse the deposit entirely.
    await reverseReceived(links);
    links = { fundMovementId: null, saleTransactionId: null };
  } else if (!wasReceived && willBeReceived) {
    // pending/disputed → received: record the deposit for the first time.
    links = await recordReceived({
      platform,
      platformOther,
      settlementNumber,
      periodStart,
      periodEnd,
      invoiceDate,
      bankAccount: nextBankAccount!,
      netAmountReceived: nextNetAmountReceived!,
      receivedDate: nextReceivedDate,
    });
  } else if (wasReceived && willBeReceived && receivedInputsChanged) {
    // Amount/account/date edited after receipt: reverse + re-record so the
    // ledger (whichever kind — fund movement or sale transaction) stays correct.
    await reverseReceived(links);
    links = await recordReceived({
      platform,
      platformOther,
      settlementNumber,
      periodStart,
      periodEnd,
      invoiceDate,
      bankAccount: nextBankAccount!,
      netAmountReceived: nextNetAmountReceived!,
      receivedDate: nextReceivedDate,
    });
  }

  return prisma.deliverySettlement.update({
    where: { id },
    data: {
      platform,
      platformOther: platform === 'other' ? platformOther?.trim() || null : null,
      settlementNumber: settlementNumber?.trim() || null,
      periodStart: parseBusinessDate(periodStart),
      periodEnd: parseBusinessDate(periodEnd),
      invoiceDate: parseBusinessDate(invoiceDate),
      grossAmount,
      commissionAmount,
      vatOnService,
      netAmount,
      netAmountReceived: willBeReceived ? nextNetAmountReceived : null,
      receivedDate: willBeReceived ? parseBusinessDate(nextReceivedDate ?? invoiceDate) : null,
      bankAccount: willBeReceived ? nextBankAccount : null,
      status: nextStatus,
      ...(data.notes !== undefined ? { notes: data.notes.trim() } : {}),
      fundMovementId: links.fundMovementId,
      saleTransactionId: links.saleTransactionId,
    },
    include: settlementInclude,
  });
}

export async function deleteDeliverySettlement(id: string) {
  const existing = await prisma.deliverySettlement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Settlement not found');

  await reverseReceived({
    fundMovementId: existing.fundMovementId,
    saleTransactionId: existing.saleTransactionId,
  });
  await prisma.deliverySettlement.delete({ where: { id } });
}

export async function listDeliverySettlements(query: {
  startDate?: string;
  endDate?: string;
  platform?: DeliveryPlatform;
  status?: SettlementStatus;
  page?: number;
  limit?: number;
}) {
  const { skip, take } = paginate(query.page, query.limit ?? 1000);
  const dateFilter = dateRangeWhere(query.startDate, query.endDate);
  const periodFilter = 'date' in dateFilter ? { periodStart: dateFilter.date } : {};

  return prisma.deliverySettlement.findMany({
    where: {
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...periodFilter,
    },
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    skip,
    take,
    include: settlementInclude,
  });
}

export async function getDeliverySettlement(id: string) {
  const settlement = await prisma.deliverySettlement.findUnique({
    where: { id },
    include: settlementInclude,
  });
  if (!settlement) throw ApiError.notFound('Settlement not found');
  return settlement;
}
