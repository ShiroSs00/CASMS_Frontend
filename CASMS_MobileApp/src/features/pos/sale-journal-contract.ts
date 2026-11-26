import { z } from 'zod';
import { saleInput, salePrice, type Sale } from './pos-contracts';
import { verifySaleIntent } from './pos-lifecycle';

export const reviewedSaleInput = saleInput.extend({ expectedUnitPrice: salePrice.shape.amount, expectedCurrency: salePrice.shape.currency });
export const pendingSale = z.object({ backend: z.string(), version: z.literal(2).optional(),
  state: z.literal('PENDING_VERIFICATION').optional(),
  endpoint: z.enum(['legacy','reviewed']).optional(), input: saleInput, serviceName: z.string(),
  reviewPrice: salePrice.optional(), originalRequest: reviewedSaleInput.optional(),
}).superRefine((value, ctx) => {
  if (value.endpoint !== 'reviewed') {
    if (value.originalRequest) ctx.addIssue({ code: 'custom', message: 'Legacy payload cannot become reviewed' });
    return;
  }
  const expected = value.reviewPrice, request = value.originalRequest;
  if (value.version !== 2 || value.state !== 'PENDING_VERIFICATION' || !expected || !request || request.expectedUnitPrice !== expected.amount
    || request.expectedCurrency !== expected.currency || JSON.stringify(saleInput.parse(request)) !== JSON.stringify(value.input))
    ctx.addIssue({ code: 'custom', message: 'Reviewed request must match the immutable confirmation' });
});
export type PendingSale = Omit<z.infer<typeof pendingSale>, 'backend'>;
export async function recoverPendingSale(client: { saleByIdempotencyKey(key: string): Promise<Sale> },
  pending: PendingSale, scope: { terminalId: string; areaId: string; owner: string }) {
  // Recovery has no mutation capability and never consults current catalogue prices.
  return verifySaleIntent(await client.saleByIdempotencyKey(pending.input.idempotencyKey), pending.input, scope, pending.reviewPrice);
}
