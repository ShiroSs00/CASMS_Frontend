import { verifySaleIntent } from './pos-lifecycle';
import { terminalChoices } from '../passenger-actions/synced-contracts';
import { terminalChoiceKey } from './terminal-choice';
import { z } from 'zod';
import { cardPreview, cardAssignment, claimCode, cardIdentifier } from '../passenger-actions/card-contracts';
import { ApiError, type RequestOptions } from '../../lib/api/api-client';
import { uuid, decode, context, service, request, activity, activityEntry, registration, participation, sale, statement, saleInput, salePrice, posSession, loginInput, type SaleInput, type SalePrice, type RequestAction, type AttendanceAction, type Credential, type ActivityAction } from './pos-contracts';
type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };

export async function readTerminalChoicesWithClient(client: Transport, signal?: AbortSignal) {
  const rows = decode(terminalChoices, await client.request('/pos/terminals', { signal }));
  if (new Set(rows.map(terminalChoiceKey)).size !== rows.length)
    throw new ApiError('Danh sách thiết bị chưa hợp lệ.', 502, 'POS_INVALID_RESPONSE');
  return rows;
}

export async function openPosWithClient(client: Transport, terminalId: string, value: Credential & { shipId?: string; areaId?: string; cruiseId?: string }) {
  const input = loginInput.parse(value);
  const expectedShipId = value.shipId ? uuid.parse(value.shipId).toLowerCase() : undefined;
  const result = decode(posSession, await client.request(`/pos-terminals/${uuid.parse(terminalId)}/sessions`, {
    method: 'POST', body: input,
  }));
  if (!result.terminal.enabled || result.terminal.terminalId !== terminalId.toLowerCase()
    || (expectedShipId && result.terminal.shipId.toLowerCase() !== expectedShipId)
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
    previewCard: async (code: string) => decode(cardPreview,
      await call('/passenger-cards/preview', { method: 'POST', body: { code: claimCode.parse(code) } })),
    confirmCard: async (code: string, identifier: string) => decode(cardAssignment,
      await call('/passenger-cards/confirm', { method: 'POST', body: { code: claimCode.parse(code), cardIdentifier: cardIdentifier.parse(identifier) } })),
    lookupCard: async (identifier: string) => decode(cardAssignment,
      await call('/passenger-cards/lookup', { method: 'POST', body: { cardIdentifier: cardIdentifier.parse(identifier) } })),
    context: async (signal?: AbortSignal) => decode(context, await call('/session', { signal })),
    close: () => call<void>('/session', { method: 'DELETE' }),
    services: async (signal?: AbortSignal) => decode(z.array(service), await call('/services', { signal })),
    requests: async (signal?: AbortSignal) => decode(z.array(request), await call('/requests', { signal })),
    requestAction: async (id: string, action: RequestAction, fulfillment?: { fulfilledQuantity: number; unitCode: string }) => {
      const value = decode(request, await call(`/requests/${uuid.parse(id)}/actions/${action}`, { method: 'POST', body: fulfillment }));
      if (value.id !== id.toLowerCase()) throw new ApiError('Yêu cầu không khớp.', 502, 'POS_INVALID_RESPONSE'); return value;
    },
    activities: async (signal?: AbortSignal) => decode(z.array(activityEntry), await call('/activities', { signal })),
    activityAction: async (id: string, action: ActivityAction) => {
      const result = decode(activity, await call(`/activities/${uuid.parse(id)}/actions/${action}`, { method: 'POST' }));
      if (result.id !== id.toLowerCase() || result.status !== ({ open: 'OPEN', start: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELLED' }[action])) throw new ApiError('Hoạt động không khớp yêu cầu.', 502, 'POS_INVALID_RESPONSE');
      return result;
    },
    registrations: async (id: string, signal?: AbortSignal) =>
      decode(z.array(registration), await call(`/activities/${uuid.parse(id)}/registrations`, { signal })),
    register: async (id: string, bookingPassengerId: string, quantity: number) => {
      const activityId = uuid.parse(id), passengerId = uuid.parse(bookingPassengerId);
      const value = decode(registration, await call(`/activities/${activityId}/registrations`, {
        method: 'POST', body: { bookingPassengerId: passengerId, quantity: z.number().int().positive().max(2147483647).parse(quantity) },
      }));
      if (value.activityId !== activityId || value.excursionId || value.bookingPassengerId !== passengerId || value.quantity !== quantity || value.status !== 'PENDING') throw new ApiError('Đăng ký không khớp.', 502, 'POS_INVALID_RESPONSE');
      return value;
    },
    updateRegistration: async (id: string, quantity: number, notes?: string | null) => decode(registration, await call(`/activity-registrations/${uuid.parse(id)}`, { method: 'PUT', body: { quantity: z.number().int().positive().max(2147483647).parse(quantity), notes: notes ?? null } })),
    registrationAction: async (id: string, action: 'confirm' | 'cancel') =>
      decode(registration, await call(`/activity-registrations/${uuid.parse(id)}/actions/${action}`, { method: 'POST' })),
    participations: async (id: string, signal?: AbortSignal) =>
      decode(z.array(participation), await call(`/activities/${uuid.parse(id)}/participations`, { signal })),
    attendance: async (id: string, action: AttendanceAction) =>
      decode(participation, await call(`/activity-participations/${uuid.parse(id)}/actions/${action}`, { method: 'POST' })),
    recordSale: async (input: SaleInput, reviewed?: SalePrice) => {
      const parsed = saleInput.parse(input);
      const expected = salePrice.parse(reviewed);
      return verifySaleIntent(decode(sale, await call('/sales/reviewed', { method: 'POST', body: { ...parsed, expectedUnitPrice: expected.amount, expectedCurrency: expected.currency } })), parsed, undefined, expected);
    },
    saleByIdempotencyKey: async (key: string, signal?: AbortSignal) => decode(sale,
      await call('/sales/by-idempotency-key', { query: { idempotencyKey: saleInput.shape.idempotencyKey.parse(key) }, signal })),
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
