import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { toSession, type LoginDto } from '@/features/auth/session-model';
import { useAuth } from '@/features/auth/session-store';

import { uuid, decode, type Credential } from './pos-contracts';
import { createScopedPosApi, openPosWithClient } from './pos-transport';
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
  return decode(z.object({ cruiseId: uuid, cruiseName: text, shipId: optionalId, shipName: optionalText }),
    await api.request(`/cruise/${uuid.parse(cruiseId)}`, { signal }));
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

export async function openPos(owner: string, signedInAt: number | undefined, terminalId: string, input: Credential & { areaId?: string; cruiseId?: string }) {
  requireEmployee(owner, signedInAt);
  const result = await openPosWithClient(api, terminalId, input);
  requireEmployee(owner, signedInAt);
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
  return createScopedPosApi({ request<T>(path: string, options: Parameters<typeof api.request>[1]) {
    requireEmployee(owner, signedInAt);
    return api.request<T>(path, options);
  } }, sessionToken);
}
