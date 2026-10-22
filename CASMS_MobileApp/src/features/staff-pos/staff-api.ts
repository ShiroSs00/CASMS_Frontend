import type { RequestOptions } from '../../lib/api/api-client';
import type { Service } from '../passenger-actions/passenger-types';
import type { Product, ProductForm, RequestAction, StaffRequest } from './staff-model';
import { productInput } from './staff-model';

type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: string) { if (!uuid.test(value)) throw new Error('Mã dữ liệu không hợp lệ.'); return encodeURIComponent(value); }
function rows<T>(value: unknown): T[] {
  if (!Array.isArray(value) || value.some(r => !r || typeof r !== 'object' || !uuid.test(r.id))) throw new Error('Danh sách từ hệ thống không hợp lệ.');
  return value as T[];
}
export function createStaffApi(client: Transport) {
  return {
    products: async (signal?: AbortSignal) => rows<Product>(await client.request('/servicepackage/products', { signal })),
    services: async (signal?: AbortSignal) => rows<Service>(await client.request('/servicepackage/services', { signal })),
    requests: async (signal?: AbortSignal) => rows<StaffRequest>(await client.request('/servicepackage/requests', { signal })),
    saveProduct: (form: ProductForm, productId?: string) => client.request<Product>(`/servicepackage/products${productId ? `/${id(productId)}` : ''}`, { method: productId ? 'PUT' : 'POST', body: productInput(form) }),
    productStatus: (productId: string, action: 'activate' | 'discontinue') => client.request<Product>(`/servicepackage/products/${id(productId)}/status/${action}`, { method: 'POST' }),
    requestAction: (requestId: string, action: RequestAction) => client.request<StaffRequest>(`/servicepackage/requests/${id(requestId)}/actions/${action}`, { method: 'POST' }),
  };
}
