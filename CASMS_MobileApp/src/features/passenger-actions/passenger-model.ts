import type { BookingCreate, BookingDetail, BookingPassenger, Cabin, Cruise, Package, PassengerDraft, Registration, Service, UserMe } from './passenger-types';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function personalPermissions(owner: string | undefined, me: UserMe | undefined): string[] | null {
  if (!owner || !me || me.userId !== owner || me.status !== 'ACTIVE' || !me.roles.length || !me.roles.every(r => r === 'PASSENGER')) return null;
  return me.effectivePermissions;
}
export function positiveQuantity(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error('Số lượng phải là số nguyên dương.');
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) throw new Error('Số lượng không hợp lệ.');
  return quantity;
}
export function buildBooking(cruiseId: string, rows: PassengerDraft[], cabins: Cabin[], paymentPlan: BookingCreate['paymentPlan'], notes: string): BookingCreate {
  if (!UUID.test(cruiseId)) throw new Error('Vui lòng chọn chuyến đi.');
  if (!rows.length) throw new Error('Cần ít nhất một hành khách.');
  if (notes.trim().length > 500) throw new Error('Ghi chú tối đa 500 ký tự.');
  const occupied = new Map<string, number>();
  const passengers = rows.map((row, index) => {
    const name = row.fullName.trim(); const email = row.email.trim(); const phone = row.phoneNumber.trim();
    if (name.length < 2 || name.length > 100) throw new Error(`Hành khách ${index + 1}: họ tên từ 2 đến 100 ký tự.`);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Hành khách ${index + 1}: email không hợp lệ.`);
    if (phone && !/^\+?\d{8,15}$/.test(phone)) throw new Error(`Hành khách ${index + 1}: số điện thoại từ 8 đến 15 chữ số.`);
    const cabin = cabins.find(c => c.cabinId === row.cabinId);
    if (!cabin || !UUID.test(row.cabinId)) throw new Error(`Hành khách ${index + 1}: vui lòng chọn phòng còn chỗ.`);
    const count = (occupied.get(row.cabinId) ?? 0) + 1; occupied.set(row.cabinId, count);
    if (count > cabin.remainingCapacity) throw new Error(`Phòng ${cabin.cabinNumber} không đủ chỗ cho số khách đã chọn.`);
    return { fullName: name, cabinId: row.cabinId, ...(email ? { email } : {}), ...(phone ? { phoneNumber: phone } : {}) };
  });
  return { cruiseId, paymentPlan, passengers, ...(notes.trim() ? { notes: notes.trim() } : {}) };
}
export function bookableCruises(items: Cruise[], now = Date.now()) { return items.filter(c => c.status === 'PUBLISHED' && Date.parse(c.departureDatetime) > now); }
export function usablePassengers(booking: BookingDetail | undefined, confirmed = true): BookingPassenger[] {
  if (!booking || (confirmed ? booking.bookingStatus !== 'Confirmed' : booking.bookingStatus === 'Cancelled')) return [];
  // Ownership is checked by BE. Never substitute a user UUID for bookingPassengerId.
  return booking.passengers.filter(p => p.participationStatus === 'Active');
}
export function packageFits(p: Package, booking: BookingDetail) {
  if (p.status !== 'ACTIVE' || booking.bookingStatus !== 'Draft') return false;
  const start = booking.departureDatetime.slice(0, 10); const end = booking.returnDatetime.slice(0, 10);
  return (!p.startDate || p.startDate <= start) && (!p.endDate || p.endDate >= end);
}
export function canRegister(status: string, endTime: string, available: number | null, quantity: number, now = Date.now()) {
  return status === 'OPEN' && Date.parse(endTime) > now && (available === null || available >= quantity);
}
export function registrationActions(row: Registration): ('confirm' | 'edit' | 'cancel')[] {
  if (row.status === 'PENDING') return ['confirm', 'edit', 'cancel'];
  return row.status === 'CONFIRMED' ? ['cancel'] : [];
}
export function serviceRequestActions(status: string): ('edit' | 'cancel')[] {
  return status === 'REQUESTED' ? ['edit', 'cancel'] : status === 'ACCEPTED' ? ['cancel'] : [];
}
export function serviceRequestInput(service: Service, quantity: string, note: string) {
  const amount = positiveQuantity(quantity);
  if (service.status !== 'ACTIVE') throw new Error('Dịch vụ hiện không tiếp nhận yêu cầu.');
  if (service.capacity !== null && amount > service.capacity) throw new Error('Số lượng vượt quá khả năng tiếp nhận của dịch vụ.');
  if (note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.');
  return { quantity: amount, note: note.trim() };
}
export function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || !currency) return 'Chưa có giá';
  try { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount); }
  catch { return `${amount.toLocaleString('vi-VN')} ${currency}`; }
}
export function dateTime(value: string | null | undefined, timeZone?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa cập nhật';
  const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
  try {
    return new Intl.DateTimeFormat('vi-VN', { ...options, ...(timeZone ? { timeZone } : {}), timeZoneName: 'shortOffset' }).format(new Date(value)).replace('GMT', 'UTC');
  } catch {
    return `${new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'UTC' }).format(new Date(value))} UTC`;
  }
}
const statuses: Record<string, string> = { BASIC: 'Cơ bản', PREMIUM: 'Cao cấp', ADVANCED: 'Nâng cao', DINING: 'Ẩm thực', WELLNESS: 'Thư giãn', LAUNDRY: 'Giặt ủi', Draft: 'Nháp', Confirmed: 'Đã xác nhận', Cancelled: 'Đã hủy', REQUESTED: 'Đang chờ', ACCEPTED: 'Đã tiếp nhận', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn tất', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy', PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', OPEN: 'Đang mở', FULL: 'Hết chỗ', PLANNED: 'Đã lên kế hoạch', ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', PAID: 'Đã thanh toán', OVERDUE: 'Quá hạn', INTERIOR: 'Phòng trong', OCEAN_VIEW: 'Phòng cửa sổ biển', BALCONY: 'Phòng ban công', SUITE: 'Suite', INCLUDED: 'Đã bao gồm', OPTIONAL: 'Tùy chọn' };
export const statusText = (status: string) => statuses[status] ?? status;
