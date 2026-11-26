import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { registrationOperation, sameRegistrationOperation, type RegistrationOperation } from './registration-operation';

const memory = new Map<string, string>();
const storageKey = (owner: string, backend: string) => 'ocv.registration.' + owner + '.' +
  Array.from(backend).map(char => char.charCodeAt(0).toString(16)).join('-');
let writes: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>) { const next = writes.catch(() => {}).then(work); writes = next; return next; }
export async function readRegistrationOperation(owner: string, backend: string) {
  const key = storageKey(owner, backend);
  const raw = Platform.OS === 'web' ? memory.get(key) : await SecureStore.getItemAsync(key);
  if (!raw) return null;
  let value: RegistrationOperation;
  try { value = registrationOperation.parse(JSON.parse(raw)); }
  catch { throw new Error('Chưa đọc được hồ sơ đăng ký đang chờ. Vui lòng liên hệ quầy để đối soát.'); }
  if (value.owner !== owner || value.backend !== backend) throw new Error('Không đọc được hồ sơ đăng ký đang chờ.');
  return value;
}
export function beginRegistrationOperation(value: RegistrationOperation) {
  const operation = registrationOperation.parse(value);
  return serialize(async () => {
    const current = await readRegistrationOperation(operation.owner, operation.backend);
    if (current) {
      if (!sameRegistrationOperation(current, operation)) throw new Error('Còn đăng ký đang chờ đối soát. Giữ nguyên nội dung thao tác gốc.');
      return current;
    }
    const key = storageKey(operation.owner, operation.backend), raw = JSON.stringify(operation);
    if (Platform.OS === 'web') memory.set(key, raw);
    else await SecureStore.setItemAsync(key, raw, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return operation;
  });
}
export function clearRegistrationOperation(operation: RegistrationOperation) {
  return serialize(async () => {
    const current = await readRegistrationOperation(operation.owner, operation.backend);
    if (!current) return;
    if (!sameRegistrationOperation(current, operation)) throw new Error('Hồ sơ đăng ký đang chờ đã thay đổi.');
    const key = storageKey(operation.owner, operation.backend);
    if (Platform.OS === 'web') memory.delete(key); else await SecureStore.deleteItemAsync(key);
  });
}
