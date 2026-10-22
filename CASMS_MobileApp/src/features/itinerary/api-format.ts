import type { DayDto, StopDto } from './itinerary-api';
export function validTimeZone(value: string | null | undefined) {
  if (!value) return null;
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: value }).format(); return value; } catch { return null; }
}
export function deviceTimeZone() {
  try { return validTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? 'UTC'; }
  catch { return 'UTC'; }
}
export function timeZoneLabel(value: string | null | undefined, at?: string) {
  const zone = validTimeZone(value);
  if (!zone) return 'UTC · Chưa có múi giờ tàu';
  const date = at && Number.isFinite(Date.parse(at)) ? new Date(at) : new Date();
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value.replace('GMT', 'UTC');
    return offset ? `${offset} · ${zone}` : zone;
  } catch { return zone; }
}
export function formatTime(value: string | null | undefined, timeZone: string | null, includeDate = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: validTimeZone(timeZone) ?? 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(includeDate ? { day: '2-digit', month: '2-digit', year: 'numeric' } as const : {}) }).format(new Date(value));
}
export function formatDay(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
export function stopsForDay(day: DayDto, stops: StopDto[]) {
  return stops.filter(stop => {
    if (stop.arrivalItineraryDayId === day.itineraryDayId || stop.departureItineraryDayId === day.itineraryDayId) return true;
    const zone = validTimeZone(day.shipTimeZoneId) ?? 'UTC';
    const dateAt = (value: string) => {
      if (!Number.isFinite(Date.parse(value))) return '';
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
      const part = (type: string) => parts.find(item => item.type === type)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    };
    const start = dateAt(stop.plannedArrival), end = dateAt(stop.plannedDeparture);
    return !!start && !!end && day.date >= start && day.date <= end;
  });
}
export const statusLabels: Record<string, string> = { DRAFT: 'Nháp', PLANNED: 'Dự kiến', PUBLISHED: 'Đã công bố', PENDING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt', OPEN_FOR_SALE: 'Mở bán', ACTIVE: 'Đang hoạt động', OPEN: 'Đang mở', FULL: 'Đã đủ chỗ', CLOSED: 'Đã đóng', IN_PROGRESS: 'Đang diễn ra', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', OMITTED: 'Bỏ điểm dừng', SUBSTITUTED: 'Đã thay thế', DELAYED: 'Chậm lịch', ASSEMBLING: 'Đang tập trung', DEPARTED: 'Đã khởi hành', RETURNED: 'Đã quay về' };
export const statusLabel = (value: string) => statusLabels[value] ?? value;
