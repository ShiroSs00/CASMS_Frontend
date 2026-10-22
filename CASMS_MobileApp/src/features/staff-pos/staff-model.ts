import type { UserMe } from '../passenger-actions/passenger-types';

export type Product = { id: string; code: string; name: string; description: string | null; type: string; price: number; currency: string; status: string };
export type ProductForm = { code: string; name: string; description: string; type: string; price: string; currency: string };
export type StaffRequest = { id: string; serviceId: string; quantity: number; note: string | null; status: string; assignedUserId: string | null; requestTime: string; completedAt: string | null; bookingId: string | null };
export type RequestAction = 'assign' | 'accept' | 'reject' | 'start' | 'complete';
export const requestActionLabels: Record<RequestAction, string> = { assign: 'Nhận phân công', accept: 'Tiếp nhận yêu cầu', reject: 'Từ chối yêu cầu', start: 'Bắt đầu thực hiện', complete: 'Hoàn tất yêu cầu' };
export function isOnboardStaff(roles: readonly string[] | undefined) { return !!roles?.includes('ONBOARD_STAFF'); }
export function staffPermissions(owner: string | undefined, me: UserMe | undefined) {
  return owner && me?.userId === owner && me.status === 'ACTIVE' && isOnboardStaff(me.roles) ? me.effectivePermissions : null;
}
export function requestActions(row: StaffRequest, owner: string, permissions: readonly string[]): RequestAction[] {
  const own = row.assignedUserId === owner;
  if (row.status === 'REQUESTED') {
    if (!row.assignedUserId) return permissions.includes('SERVICE_REQUEST_ASSIGN') ? ['assign'] : [];
    return own && permissions.includes('SERVICE_REQUEST_EXECUTE') ? ['accept', 'reject'] : [];
  }
  if (!own || !permissions.includes('SERVICE_REQUEST_EXECUTE')) return [];
  return row.status === 'ACCEPTED' ? ['start'] : row.status === 'IN_PROGRESS' ? ['complete'] : [];
}
export function productInput(form: ProductForm) {
  const code = form.code.trim(), name = form.name.trim(), type = form.type.trim(), description = form.description.trim(), currency = form.currency.trim().toUpperCase();
  if (!code || code.length > 50) throw new Error('Mã sản phẩm từ 1 đến 50 ký tự.');
  if (!name || name.length > 200) throw new Error('Tên sản phẩm từ 1 đến 200 ký tự.');
  if (!type || type.length > 50) throw new Error('Loại sản phẩm từ 1 đến 50 ký tự.');
  if (description.length > 1000) throw new Error('Mô tả tối đa 1000 ký tự.');
  const raw = form.price.trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,4})?$/.test(raw)) throw new Error('Đơn giá phải là số không âm, tối đa 9 chữ số nguyên và 4 chữ số thập phân.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Nhập mã tiền tệ gồm 3 chữ cái, ví dụ VND hoặc USD.');
  return { productCode: code, productName: name, description: description || null, productType: type, unitPrice: Number(raw), currencyCode: currency };
}
