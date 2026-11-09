import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';
import { registerSessionCleanup, useAuth } from '@/features/auth/session-store';
import { api, getApiUrl } from '@/lib/api';
import { posSession, saleInput, uuid, type PosSession } from './pos-api';

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
  return changeSession(async () => {
    const employee = useAuth.getState().session;
    if (employee?.user.id !== owner || employee.signedInAt !== signedInAt) throw new Error('Phiên nhân viên đã thay đổi.');
    await SecureStore.setItemAsync(sessionKey,
      JSON.stringify({ owner, signedInAt: employee.signedInAt, backend: getApiUrl(), session }), accessibility);
    const current = useAuth.getState().session;
    if (current?.user.id !== owner || current.signedInAt !== signedInAt) {
      await SecureStore.deleteItemAsync(sessionKey);
      throw new Error('Phiên nhân viên đã thay đổi.');
    }
    activeSession = { owner, signedInAt, backend: getApiUrl(), session };
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

const pendingSale = z.object({ backend: z.string(), input: saleInput, serviceName: z.string() });
export type PendingSale = Omit<z.infer<typeof pendingSale>, 'backend'>;
const journal = pendingSale.extend({ owner: uuid, areaId: uuid, cruiseId: uuid });
export type SaleScope = { owner: string; terminalId: string; areaId: string; cruiseId: string };
export type PendingRecord = { kind: 'own'; sale: PendingSale } | { kind: 'blocked' };

const terminalKey = (terminalId: string) => `ocevie.pos.pending-terminal.${terminalId}`;
const legacyKey = ({ owner, terminalId, areaId, cruiseId }: SaleScope) => `ocevie.pos.pending.${owner}.${terminalId}.${areaId}.${cruiseId}`;

export async function readPendingSale(scope: SaleScope): Promise<PendingRecord | null> {
  const rawJournal = await SecureStore.getItemAsync(terminalKey(scope.terminalId));
  if (rawJournal) {
    const saved = journal.parse(JSON.parse(rawJournal));
    if (saved.backend !== getApiUrl() || saved.owner !== scope.owner
      || saved.areaId !== scope.areaId || saved.cruiseId !== scope.cruiseId) return { kind: 'blocked' };
    return { kind: 'own', sale: { input: saved.input, serviceName: saved.serviceName } };
  }
  const raw = await SecureStore.getItemAsync(legacyKey(scope));
  if (!raw) return null;
  const saved = pendingSale.parse(JSON.parse(raw));
  if (saved.backend !== getApiUrl()) return { kind: 'blocked' };
  return { kind: 'own', sale: { input: saved.input, serviceName: saved.serviceName } };
}

export async function savePendingSale(scope: SaleScope, sale: PendingSale) {
  const { owner, terminalId, areaId, cruiseId } = scope;
  await SecureStore.setItemAsync(terminalKey(terminalId),
    JSON.stringify({ ...sale, owner, areaId, cruiseId, backend: getApiUrl() }), accessibility);
}

export async function clearPendingSale(scope: SaleScope) {
  // Keep the terminal lock until both records are gone, including records from the original flow.
  await SecureStore.deleteItemAsync(legacyKey(scope));
  await SecureStore.deleteItemAsync(terminalKey(scope.terminalId));
}
