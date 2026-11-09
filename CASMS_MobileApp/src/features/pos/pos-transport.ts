import { z } from 'zod';
import { ApiError, type RequestOptions } from '../../lib/api/api-client';
import { uuid, decode, context, service, request, activity, activityEntry, registration, participation, sale, statement, saleInput, posSession, loginInput, type SaleInput, type RequestAction, type AttendanceAction, type Credential, type ActivityAction } from './pos-contracts';
type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };

export async function openPosWithClient(client: Transport, terminalId: string, value: Credential & { areaId?: string; cruiseId?: string }) {
  const input = loginInput.parse(value);
  const result = decode(posSession, await client.request(`/pos-terminals/${uuid.parse(terminalId)}/sessions`, {
    method: 'POST', body: input,
  }));
  if (!result.terminal.enabled || result.terminal.terminalId !== terminalId.toLowerCase()
    || (input.areaId && result.terminal.areaId !== input.areaId.toLowerCase())
    || (input.cruiseId && result.cruiseId !== input.cruiseId.toLowerCase())
    || Date.parse(result.expiresAt) <= Date.now()) {
    throw new ApiError('Phiên POS không khớp thiết bị hoặc đã hết hạn.', 502, 'POS_INVALID_RESPONSE');
  }
  return result;
}

export function createScopedPosApi(client: Transport, sessionToken: string) {
  async function call<T>(path: string, options: RequestOptions = {}) {
    if (!sessionToken.trim()) throw new ApiError('Cần xác minh phiên POS.', 401, 'POS_SESSION_REQUIRED');
    return client.request<T>(`/pos${path}`, { ...options, posSession: sessionToken });
  }
  return {
    context: async (signal?: AbortSignal) => decode(context, await call('/session', { signal })),
    close: () => call<void>('/session', { method: 'DELETE' }),
    services: async (signal?: AbortSignal) => decode(z.array(service), await call('/services', { signal })),
    requests: async (signal?: AbortSignal) => decode(z.array(request), await call('/requests', { signal })),
    requestAction: async (id: string, action: RequestAction, fulfillment?: { fulfilledQuantity: number; unitCode: string }) =>
      decode(request, await call(`/requests/${uuid.parse(id)}/actions/${action}`, { method: 'POST', body: fulfillment })),
    activities: async (signal?: AbortSignal) => decode(z.array(activityEntry), await call('/activities', { signal })),
    activityAction: async (id: string, action: ActivityAction) => {
      const result = decode(activity, await call(`/activities/${uuid.parse(id)}/actions/${action}`, { method: 'POST' }));
      if (result.id !== id.toLowerCase()) throw new ApiError('Hoạt động không khớp yêu cầu.', 502, 'POS_INVALID_RESPONSE');
      return result;
    },
    registrations: async (id: string, signal?: AbortSignal) =>
      decode(z.array(registration), await call(`/activities/${uuid.parse(id)}/registrations`, { signal })),
    register: async (id: string, bookingPassengerId: string, quantity: number) =>
      decode(registration, await call(`/activities/${uuid.parse(id)}/registrations`, {
        method: 'POST', body: { bookingPassengerId: uuid.parse(bookingPassengerId), quantity },
      })),
    registrationAction: async (id: string, action: 'confirm' | 'cancel') =>
      decode(registration, await call(`/activity-registrations/${uuid.parse(id)}/actions/${action}`, { method: 'POST' })),
    participations: async (id: string, signal?: AbortSignal) =>
      decode(z.array(participation), await call(`/activities/${uuid.parse(id)}/participations`, { signal })),
    attendance: async (id: string, action: AttendanceAction) =>
      decode(participation, await call(`/activity-participations/${uuid.parse(id)}/actions/${action}`, { method: 'POST' })),
    recordSale: async (input: SaleInput) => decode(sale, await call('/sales', { method: 'POST', body: saleInput.parse(input) })),
    sale: async (id: string, signal?: AbortSignal) => {
      const result = decode(sale, await call(`/sales/${uuid.parse(id)}`, { signal }));
      if (result.saleId !== id.toLowerCase()) throw new ApiError('Bản ghi không khớp giao dịch.', 502, 'POS_INVALID_RESPONSE');
      return result;
    },
    statement: async (account: string, passenger: string, signal?: AbortSignal) => {
      const result = decode(statement,
        await call(`/accounts/${uuid.parse(account)}/passengers/${uuid.parse(passenger)}/statement`, { signal }));
      if (result.budget.accountId !== account) throw new ApiError('Sao kê không khớp tài khoản.', 502, 'POS_INVALID_RESPONSE');
      return result;
    },
  };
}
