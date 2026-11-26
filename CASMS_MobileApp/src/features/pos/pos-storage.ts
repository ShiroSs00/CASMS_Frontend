import { pendingSale, type PendingSale } from './sale-journal-contract';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';
import { registerSessionCleanup, useAuth } from '@/features/auth/session-store';
import { api, ApiError, getApiUrl } from '@/lib/api';
import { posSession, uuid, type PosSession } from './pos-api';
export type { PendingSale } from './sale-journal-contract';

const sessionKey = 'ocevie.pos.session.v1';
const accessibility = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const storedSession = z.object({ owner: uuid, signedInAt: z.number(), backend: z.string(), session: posSession });
let sessionWrite: Promise<void> = Promise.resolve();
let activeSession: z.infer<typeof storedSession> | null = null;

registerSessionCleanup(() => {
  const saved = activeSession;
  activeSession = null;
  const employee = useAuth.getState().session;
  if (!saved || saved.backend !== getApiUrl() || saved.owner !== employee?.user.id
    || saved.signedInAt !== employee.signedInAt) return Promise.resolve();
  // request() captures the employee bearer synchronously before logout clears it.
  return api.request('/pos/session', { method: 'DELETE', posSession: saved.session.sessionToken });
});

function changeSession(work: () => Promise<void>) {
  sessionWrite = sessionWrite.catch(() => {}).then(work);
  return sessionWrite;
}

export function savePosSession(owner: string, session: PosSession, signedInAt: number) {
  const backend = getApiUrl();
  return changeSession(async () => {
    const employee = useAuth.getState().session;
    if (getApiUrl() !== backend || employee?.user.id !== owner || employee.signedInAt !== signedInAt) throw new Error('Phiên nhân viên đã thay đổi.');
    await SecureStore.setItemAsync(sessionKey,
      JSON.stringify({ owner, signedInAt: employee.signedInAt, backend, session }), accessibility);
    const current = useAuth.getState().session;
    if (getApiUrl() !== backend || current?.user.id !== owner || current.signedInAt !== signedInAt) {
      await SecureStore.deleteItemAsync(sessionKey);
      throw new Error('Phiên nhân viên đã thay đổi.');
    }
    activeSession = { owner, signedInAt, backend, session };
  });
}

export function clearPosSession(owner: string, signedInAt: number, token?: string) {
  return changeSession(async () => {
    const raw = await SecureStore.getItemAsync(sessionKey);
    if (!raw) return;
    const saved = parseSession(raw);
    if (saved?.owner === owner && saved.signedInAt === signedInAt && (!token || saved.session.sessionToken === token)) {
      await SecureStore.deleteItemAsync(sessionKey);
      if (activeSession?.session.sessionToken === saved.session.sessionToken) activeSession = null;
    }
  });
}

function parseSession(raw: string) {
  try {
    const result = storedSession.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

export async function restorePosSession(owner: string, signedInAt: number) {
  await sessionWrite.catch(() => {});
  const raw = await SecureStore.getItemAsync(sessionKey);
  if (!raw) return { session: null, expired: false };
  const value = parseSession(raw);
  const employee = useAuth.getState().session;
  if (employee?.user.id !== owner || employee.signedInAt !== signedInAt) return { session: null, expired: false };
  const bound = value?.owner === owner && value.signedInAt === signedInAt && value.backend === getApiUrl();
  if (value && bound && value.session.terminal.enabled && Date.parse(value.session.expiresAt) > Date.now()) {
    activeSession = value;
    return { session: value.session, expired: false };
  }
  await changeSession(async () => {
    if (await SecureStore.getItemAsync(sessionKey) === raw) await SecureStore.deleteItemAsync(sessionKey);
  });
  return { session: null, expired: bound };
}

useAuth.subscribe((next, previous) => {
  const old = previous.session;
  if (Platform.OS !== 'web' && old
    && (old.user.id !== next.session?.user.id || old.signedInAt !== next.session?.signedInAt)) {
    void clearPosSession(old.user.id, old.signedInAt).catch(() => {});
  }
});

const journal = pendingSale.safeExtend({ terminalId: uuid.optional(), owner: uuid, areaId: uuid, cruiseId: uuid, signedInAt: z.number().optional() });
export type SaleScope = { owner: string; terminalId: string; areaId: string; cruiseId: string; signedInAt?: number };
export type PendingRecord = { kind: 'own'; sale: PendingSale; previousSession?: boolean } | { kind: 'blocked' };

const terminalKey = (terminalId: string) => `ocevie.pos.pending-terminal.${terminalId}`;
const legacyKey = ({ owner, terminalId, areaId, cruiseId }: SaleScope) => `ocevie.pos.pending.${owner}.${terminalId}.${areaId}.${cruiseId}`;

export async function readPendingSale(scope: SaleScope, backend = getApiUrl()): Promise<PendingRecord | null> {
  const rawJournal = await SecureStore.getItemAsync(terminalKey(scope.terminalId));
  if (rawJournal) {
    const saved = journal.parse(JSON.parse(rawJournal));
    if (saved.backend !== backend || saved.owner !== scope.owner || saved.terminalId && saved.terminalId !== scope.terminalId
      || saved.areaId !== scope.areaId || saved.cruiseId !== scope.cruiseId) return { kind: 'blocked' };
    const legacy = await SecureStore.getItemAsync(legacyKey(scope));
    if (legacy) {
      const prior = pendingSale.parse(JSON.parse(legacy));
      if (prior.backend !== backend || !samePendingSale(prior, saved)) return { kind: 'blocked' };
    }
    return { kind: 'own', sale: { ...(saved.state ? { state: saved.state } : {}), ...(saved.version ? { version: saved.version } : {}), ...(saved.endpoint ? { endpoint: saved.endpoint } : {}), ...(saved.originalRequest ? { originalRequest: saved.originalRequest } : {}), input: saved.input, serviceName: saved.serviceName, ...(saved.reviewPrice ? { reviewPrice: saved.reviewPrice } : {}) },
      ...(scope.signedInAt !== undefined && saved.signedInAt !== scope.signedInAt ? { previousSession: true } : {}) };
  }
  const raw = await SecureStore.getItemAsync(legacyKey(scope));
  if (!raw) return null;
  const saved = pendingSale.parse(JSON.parse(raw));
  if (saved.backend !== backend) return { kind: 'blocked' };
  return { kind: 'own', sale: { ...(saved.state ? { state: saved.state } : {}), ...(saved.version ? { version: saved.version } : {}), ...(saved.endpoint ? { endpoint: saved.endpoint } : {}), ...(saved.originalRequest ? { originalRequest: saved.originalRequest } : {}), input: saved.input, serviceName: saved.serviceName, ...(saved.reviewPrice ? { reviewPrice: saved.reviewPrice } : {}) },
    ...(scope.signedInAt !== undefined ? { previousSession: true } : {}) };
}


// Serialize compare/write/clear in this runtime; a different employee/environment stays blocked.
let journalWrites: Promise<unknown> = Promise.resolve();
function serializeJournal<T>(work: () => Promise<T>) {
  const result = journalWrites.catch(() => {}).then(work); journalWrites = result; return result;
}
export function savePendingSale(scope: SaleScope, sale: PendingSale) {
  const backend = getApiUrl();
  return serializeJournal(async () => {
    const current = await readPendingSale(scope, backend);
    if (current && (current.kind !== 'own' || !samePendingSale(current.sale, sale)))
      throw new ApiError('Còn giao dịch khác cần đối soát.', 409, 'POS_SALE_BUSY');
    await SecureStore.setItemAsync(terminalKey(scope.terminalId),
      JSON.stringify(journal.parse({ ...sale, ...scope, backend })), accessibility);
  });
}
export function clearPendingSale(scope: SaleScope, expectedKey?: string) {
  const backend = getApiUrl();
  return serializeJournal(async () => {
    const current = await readPendingSale(scope, backend);
    if (!current) return;
    if (current.kind !== 'own' || expectedKey && current.sale.input.idempotencyKey !== expectedKey)
      throw new ApiError('Giao dịch chờ đã thay đổi.', 409, 'POS_SALE_BUSY');
    await SecureStore.deleteItemAsync(legacyKey(scope));
    await SecureStore.deleteItemAsync(terminalKey(scope.terminalId));
  });
}

function sameSaleInput(a: PendingSale['input'], b: PendingSale['input']) {
  return a.idempotencyKey === b.idempotencyKey && a.serviceId === b.serviceId && a.bookingPassengerId === b.bookingPassengerId
    && a.onboardAccountId === b.onboardAccountId && a.scheduleId === b.scheduleId && a.quantity === b.quantity;
}

function samePendingSale(a: Pick<PendingSale, 'input' | 'reviewPrice' | 'endpoint' | 'originalRequest'>, b: Pick<PendingSale, 'input' | 'reviewPrice' | 'endpoint' | 'originalRequest'>) {
  return JSON.stringify(a.originalRequest) === JSON.stringify(b.originalRequest) && (a.endpoint ?? 'legacy') === (b.endpoint ?? 'legacy') && sameSaleInput(a.input, b.input) && a.reviewPrice?.amount === b.reviewPrice?.amount && a.reviewPrice?.currency === b.reviewPrice?.currency;
}
