import { decodeOnboard, serviceOperationSchema } from './onboard-contracts';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getApiUrl } from '@/lib/api';

export type PendingServiceOperation = {
  key: string; bookingId: string; bookingPassengerId: string; serviceId: string;
  payload?: { quantity: number; scheduleId: string | null; noteFingerprint: string };
};
const memory = new Map<string, string>();
const storageKey = (owner: string, backend = getApiUrl()) => 'ocv.service.operation.' + owner + '.' +
  Array.from(backend).map(char => char.charCodeAt(0).toString(16)).join('-');

export async function readServiceOperation(owner: string, backend = getApiUrl()): Promise<PendingServiceOperation | null> {
  const key = storageKey(owner, backend);
  const value = Platform.OS === 'web' ? memory.get(key) : await SecureStore.getItemAsync(key);
  if (!value) return null;
  try { return decodeOnboard(serviceOperationSchema, JSON.parse(value)); }
  catch { throw new Error('Chưa đọc được mã yêu cầu đang chờ đối chiếu.'); }
}

export async function saveServiceOperation(owner: string, operation: PendingServiceOperation | null, backend = getApiUrl()) {
  const key = storageKey(owner, backend);
  if (operation) operation = decodeOnboard(serviceOperationSchema, operation);
  if (Platform.OS === 'web') {
    if (operation) memory.set(key, JSON.stringify(operation));
    else memory.delete(key);
    return;
  }
  if (operation) await SecureStore.setItemAsync(key, JSON.stringify(operation),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(key);
}

export function newServiceOperationKey() {
  return 'service-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
    + '-' + Math.random().toString(36).slice(2);
}

// Serialize operation creation across mounted screens in the same application instance.
let operationWrites: Promise<unknown> = Promise.resolve();
export function beginServiceOperation(owner: string, proposed: PendingServiceOperation) {
  const backend = getApiUrl();
  const result = operationWrites.catch(() => {}).then(async () => {
    const current = await readServiceOperation(owner, backend);
    if (current) return current;
    await saveServiceOperation(owner, proposed, backend);
    return proposed;
  });
  operationWrites = result;
  return result;
}

export function clearServiceOperation(owner: string, operationKey: string) {
  const backend = getApiUrl();
  const result = operationWrites.catch(() => {}).then(async () => {
    const current = await readServiceOperation(owner, backend);
    if (current?.key === operationKey) await saveServiceOperation(owner, null, backend);
  });
  operationWrites = result;
  return result;
}
