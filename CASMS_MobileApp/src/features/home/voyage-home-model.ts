import type { PersonalVoyage } from '../passenger-actions/passenger-api';
import type { DayDto } from '../itinerary/itinerary-client';
import { dateAt, validTimeZone } from '../itinerary/api-format';

export const voyageLabel: Record<PersonalVoyage['cruiseStatus'], string> = {
  DRAFT: 'Đang chuẩn bị', PUBLISHED: 'Sắp khởi hành', IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc', CANCELLED: 'Đã hủy',
};

export function itineraryToday(days: readonly DayDto[], now: number) {
  const moment = new Date(now).toISOString();
  const matches = days.filter(day => {
    const zone = validTimeZone(day.shipTimeZoneId);
    return zone && day.date === dateAt(moment, zone);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function nextRegisteredActivity(voyage: PersonalVoyage | undefined, now: number) {
  if (!voyage || ['COMPLETED', 'CANCELLED'].includes(voyage.cruiseStatus)) return;
  const upcoming = voyage.registeredActivities.filter(item =>
    item.startTime && Date.parse(item.startTime) >= now
    && item.registrationStatus === 'CONFIRMED'
    && !['CANCELLED', 'COMPLETED'].includes(item.activityStatus));
  return upcoming.sort((a, b) => Date.parse(a.startTime ?? '') - Date.parse(b.startTime ?? ''))[0];
}
