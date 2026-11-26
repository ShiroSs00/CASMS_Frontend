import { z } from 'zod';
import { entitlementSchema } from '../passenger-actions/onboard-contracts';
import { api, ApiError, getApiUrl } from '@/lib/api';
import { toSession, type LoginDto } from '@/features/auth/session-model';
import { useAuth } from '@/features/auth/session-store';

import { uuid, decode, type Credential } from './pos-contracts';
import { createScopedPosApi, openPosWithClient, readTerminalChoicesWithClient } from './pos-transport';
export * from './pos-contracts';
const text = z.string();
const permissions = z.array(text);
const optionalId = uuid.nullable().default(null);
const optionalText = text.nullable().default(null);

export async function readEmployee(signal?: AbortSignal) {
  return decode(z.object({ userId: uuid, username: text, status: text, roles: permissions, effectivePermissions: permissions }),
    await api.request('/auth/me', { signal }));
}

export async function readCruiseLabel(cruiseId: string, signal?: AbortSignal) {
  const result = decode(z.object({ cruiseId: uuid, cruiseName: text, shipId: optionalId, shipName: optionalText }),
    await api.request(`/cruise/${uuid.parse(cruiseId)}`, { signal }));
  if (result.cruiseId.toLowerCase() !== cruiseId.toLowerCase()) throw new ApiError('Tên chuyến không khớp phân công.', 502, 'POS_INVALID_RESPONSE');
  return result;
}

export async function readShipLabel(shipId: string, signal?: AbortSignal) {
  return decode(z.object({ shipId: uuid, shipName: text }),
    await api.request(`/ships/${uuid.parse(shipId)}`, { signal }));
}

export async function readAreaLabel(shipId: string, areaId: string, signal?: AbortSignal) {
  const areas = decode(z.array(z.object({ shipId: uuid, id: uuid, name: text })),
    await api.request(`/ships/${uuid.parse(shipId)}/areas`, { signal }));
  return areas.find(area => area.shipId === shipId && area.id === areaId)?.name ?? null;
}

export async function deviceCredential(username: string, password: string): Promise<Credential> {
  const dto = await api.request<LoginDto>('/auth/login', {
    method: 'POST', authenticated: false, body: { username: username.trim(), password },
  });
  const device = toSession(dto);
  if (device.user.roles.length !== 1 || device.user.roles[0] !== 'POS') {
    throw new ApiError('Hãy dùng tài khoản thiết bị chỉ có vai trò POS.', 422, 'POS_DEVICE_ROLE');
  }
  return { deviceAccessToken: device.accessToken };
}

export async function readTerminals(signal?: AbortSignal, employeePermissions?: readonly string[]) {
  const rows = await readTerminalChoicesWithClient(api, signal);
  const areas = new Map<string, Promise<string | null>>();
  const cruises = new Map<string, ReturnType<typeof readCruiseLabel>>();
  return Promise.all(rows.map(async row => {
    if (!employeePermissions || employeePermissions.includes('CRUISE_READ')) {
      if (!cruises.has(row.cruiseId)) cruises.set(row.cruiseId, readCruiseLabel(row.cruiseId, signal));
    }
    const areaKey = `${row.shipId}:${row.areaId}`;
    if (!employeePermissions || employeePermissions.includes('SHIP_READ')) {
      if (!areas.has(areaKey)) areas.set(areaKey, readAreaLabel(row.shipId, row.areaId, signal).catch(() => null));
    }
    const [cruise, areaName] = await Promise.all([cruises.get(row.cruiseId)?.catch(() => null), areas.get(areaKey)]);
    return { ...row, areaName: areaName ?? null,
      cruiseName: cruise?.shipId?.toLowerCase() === row.shipId ? cruise.cruiseName : null };
  }));
}

export async function openPos(owner: string, signedInAt: number | undefined, terminalId: string, input: Credential & { shipId?: string; areaId?: string; cruiseId?: string }) {
  const backend = getApiUrl();
  requireEmployee(owner, signedInAt);
  const result = await openPosWithClient(api, terminalId, input);
  requireEmployee(owner, signedInAt);
  if (getApiUrl() !== backend) throw new ApiError('Môi trường API đã thay đổi.', 409, 'POS_REVERIFY');
  return result;
}

function requireEmployee(owner: string, signedInAt: number | undefined) {
  const employee = useAuth.getState().session;
  if (useAuth.getState().status !== 'authenticated' || employee?.user.id !== owner || employee.signedInAt !== signedInAt
    || employee.expiresAt <= Date.now()) {
    throw new ApiError('Phiên nhân viên đã thay đổi.', 401);
  }
}

export function scopedPos(owner: string, signedInAt: number | undefined, sessionToken: string) {
  const backend = getApiUrl();
  return createScopedPosApi({ async request<T>(path: string, options: Parameters<typeof api.request>[1]) {
    requireEmployee(owner, signedInAt);
    if (getApiUrl() !== backend) throw new ApiError('Môi trường API đã thay đổi.', 409, 'POS_REVERIFY');
    const result = await api.request<T>(path, options);
    try { requireEmployee(owner, signedInAt); } catch { throw new ApiError('Kết quả đến sau khi phiên thay đổi.', 502, 'POS_STALE_RESULT'); }
    if (getApiUrl() !== backend) throw new ApiError('Kết quả đến sau khi môi trường thay đổi.', 502, 'POS_STALE_RESULT');
    return result;
  } }, sessionToken);
}

// This employee API is outside /pos: never attach X-POS-Session.
export async function readRequestEntitlement(owner: string, signedInAt: number, requestId: string, bookingPassengerId: string, signal?: AbortSignal) {
  const backend = getApiUrl(); requireEmployee(owner, signedInAt);
  const result = decode(z.object({ operationId: uuid, entitlement: entitlementSchema.nullable().default(null) }),
    await api.request(`/servicepackage/requests/${uuid.parse(requestId)}/fare-entitlement`, { signal }));
  requireEmployee(owner, signedInAt);
  if (backend !== getApiUrl() || result.operationId !== requestId || result.entitlement && result.entitlement.bookingPassengerId !== bookingPassengerId)
    throw new ApiError('Quyền lợi không khớp yêu cầu.', 502, 'POS_INVALID_RESPONSE');
  return result;
}
