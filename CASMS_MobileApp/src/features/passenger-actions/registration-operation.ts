import { z } from 'zod';
import type { Registration } from './passenger-types';

export const registrationOperation = z.object({ version: z.literal(1), key: z.string().min(1).max(100),
  backend: z.string().min(1), owner: z.guid(), signedInAt: z.number(), bookingId: z.guid(), cruiseId: z.guid(),
  bookingPassengerId: z.guid(), kind: z.enum(['activity','excursion']), resourceId: z.guid(),
  quantity: z.number().int().positive().max(2147483647),
});
export type RegistrationOperation = z.infer<typeof registrationOperation>;
export function sameRegistrationOperation(a: RegistrationOperation, b: RegistrationOperation) {
  return a.key === b.key && a.backend === b.backend && a.owner === b.owner && a.signedInAt === b.signedInAt
    && a.bookingId === b.bookingId && a.cruiseId === b.cruiseId && a.bookingPassengerId === b.bookingPassengerId
    && a.kind === b.kind && a.resourceId === b.resourceId && a.quantity === b.quantity;
}
export function verifyRegistrationOperation(row: Registration, operation: RegistrationOperation) {
  if (row.bookingPassengerId !== operation.bookingPassengerId || row.quantity !== operation.quantity
    || (operation.kind === 'activity' ? row.activityId !== operation.resourceId || row.excursionId !== null
      : row.excursionId !== operation.resourceId || row.activityId !== null))
    throw new Error('Kết quả đăng ký chưa khớp thao tác gốc. Hồ sơ chờ được giữ để đối soát.');
  return row;
}
