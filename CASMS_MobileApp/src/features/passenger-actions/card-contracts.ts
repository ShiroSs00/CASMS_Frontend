import { z } from 'zod';

export const claimCode = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const cardIdentifier = z.string().regex(/^(?:[0-9a-fA-F]{2}){4,32}$/);
export const cardClaim = z.object({ code: claimCode, expiresAt: z.iso.datetime({ offset: true }) });
export const cardPreview = z.object({ bookingPassengerId: z.guid(), passengerName: z.string().min(1) });
export const cardAssignment = cardPreview.extend({ confirmedAt: z.iso.datetime({ offset: true }) });
export function readCardClaim(value: unknown, now = Date.now()) {
  const result = cardClaim.safeParse(value);
  if (!result.success || Date.parse(result.data.expiresAt) <= now) throw new Error('Mã nhận thẻ không hợp lệ hoặc đã hết hạn.');
  return result.data;
}
export function remainingClaimSeconds(expiresAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}
