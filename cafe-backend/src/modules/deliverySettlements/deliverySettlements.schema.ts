import { z } from 'zod';

const deliveryPlatformSchema = z.enum(['foodpanda', 'foodi', 'other']);
const settlementStatusSchema = z.enum(['pending', 'received', 'disputed']);
const fundAccountTypeSchema = z.enum(['cash', 'bank', 'bkash', 'reserve']);

/** React Hook Form sends "" for hidden selects; treat as omitted (mirrors funds.schema.ts). */
const optionalBankAccountSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  fundAccountTypeSchema.optional(),
);

const settlementBaseSchema = z.object({
  platform: deliveryPlatformSchema,
  platformOther: z.string().trim().max(60).optional(),
  settlementNumber: z.string().trim().max(80).optional(),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  grossAmount: z.number().min(0),
  commissionAmount: z.number().min(0).optional(),
  vatOnService: z.number().min(0).optional(),
  netAmountReceived: z.number().min(0).optional(),
  receivedDate: z.string().optional(),
  bankAccount: optionalBankAccountSchema,
  status: settlementStatusSchema.optional(),
  notes: z.string().optional(),
});

function refineSettlement(data: z.infer<typeof settlementBaseSchema>, ctx: z.RefinementCtx) {
  if (data.platform === 'other' && !data.platformOther?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Platform name is required when platform is "Other"',
      path: ['platformOther'],
    });
  }

  if (data.periodStart && data.periodEnd && new Date(data.periodEnd) < new Date(data.periodStart)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Period end must be on or after period start',
      path: ['periodEnd'],
    });
  }

  const wantsReceived = data.status === 'received' || data.netAmountReceived !== undefined;
  if (wantsReceived) {
    if (data.netAmountReceived === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Received amount is required to mark a settlement as received',
        path: ['netAmountReceived'],
      });
    }
    if (!data.bankAccount) {
      ctx.addIssue({
        code: 'custom',
        message: 'Deposit account is required to mark a settlement as received',
        path: ['bankAccount'],
      });
    }
  }
}

export const deliverySettlementCreateSchema = settlementBaseSchema.superRefine(refineSettlement);

export const deliverySettlementUpdateSchema = settlementBaseSchema
  .partial()
  .extend({ platform: deliveryPlatformSchema.optional() })
  .superRefine((data, ctx) => {
    if (data.platform === 'other' && !data.platformOther?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Platform name is required when platform is "Other"',
        path: ['platformOther'],
      });
    }
    if (data.periodStart && data.periodEnd && new Date(data.periodEnd) < new Date(data.periodStart)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Period end must be on or after period start',
        path: ['periodEnd'],
      });
    }
    if (data.status === 'received') {
      if (data.netAmountReceived === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Received amount is required to mark a settlement as received',
          path: ['netAmountReceived'],
        });
      }
      if (!data.bankAccount) {
        ctx.addIssue({
          code: 'custom',
          message: 'Deposit account is required to mark a settlement as received',
          path: ['bankAccount'],
        });
      }
    }
  });

export const deliverySettlementsListQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  platform: deliveryPlatformSchema.optional(),
  status: settlementStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type DeliverySettlementCreateInput = z.infer<typeof deliverySettlementCreateSchema>;
export type DeliverySettlementUpdateInput = z.infer<typeof deliverySettlementUpdateSchema>;
