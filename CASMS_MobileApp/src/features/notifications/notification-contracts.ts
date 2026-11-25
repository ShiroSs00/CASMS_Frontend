import { z } from 'zod';
export const notificationSchema = z.object({
  notificationId: z.guid(), bookingPassengerId: z.guid().nullable().default(null),
  title: z.string(), content: z.string(), notificationType: z.string(),
  createdAt: z.iso.datetime({ offset: true }), readAt: z.iso.datetime({ offset: true }).nullable().default(null),
});
export const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export function uniqueNotifications(rows: z.infer<typeof notificationSchema>[]) {
  const map = new Map<string, z.infer<typeof notificationSchema>>();
  for (const row of rows) {
    const prior = map.get(row.notificationId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error('Thông báo trùng mã nhưng khác nội dung. Vui lòng tải lại.');
    map.set(row.notificationId, row);
  }
  return [...map.values()].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function notificationDestination(item: z.infer<typeof notificationSchema>, voyages: readonly { bookingPassengerId: string; bookingId: string; cruiseId: string; itineraryId?: string | null }[], currentBP?: string) {
  if (item.notificationType !== 'CRUISE_SCHEDULE_CHANGE' || !item.bookingPassengerId) return { kind: 'unavailable' as const };
  const voyage = voyages.find(row => row.bookingPassengerId === item.bookingPassengerId);
  if (!voyage?.itineraryId) return { kind: 'unavailable' as const };
  return { kind: currentBP === voyage.bookingPassengerId ? 'itinerary' as const : 'switch' as const, voyage };
}
