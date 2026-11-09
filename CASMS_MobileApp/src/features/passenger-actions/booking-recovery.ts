import { uuid } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import type { BookingCreate } from './passenger-types';
import { withIntentLock } from '@/lib/intent-lock';

const journal = z.object({
  owner: z.guid(),
  apiUrl: z.string(),
  idempotencyKey: z.uuidv4(),
  expiresAt: z.iso.datetime({ offset: true }),
  rejected: z.boolean().optional(),
  body: z.object({
    cruiseId: z.guid(), quoteId: z.guid(), quoteGuestToken: z.string().min(1).max(100).optional(), currency: z.literal('USD'),
    paymentPlan: z.enum(['FULL', 'DEPOSIT', 'STAGES']),
    notes: z.string().optional(),
    passengers: z.array(z.object({
      fullName: z.string(), cabinId: z.guid(), email: z.string().optional(), phoneNumber: z.string().optional(),
    })).min(1),
  }),
});

export type BookingIntent = z.infer<typeof journal>;
type Scope = Pick<BookingIntent, 'owner' | 'apiUrl'>;
const accessibility = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const storageKey = ({ owner, apiUrl }: Scope) => `ocevie.booking.v1.${uuid.v5(JSON.stringify([apiUrl, owner]), uuid.namespace.url)}`;

export function newBookingIntent(scope: Scope, body: BookingCreate, quote: { quoteId: string; expiresAt: string; guestToken?: string | null }): BookingIntent {
  return {
    ...scope, idempotencyKey: uuid.v4(), expiresAt: quote.expiresAt,
    body: { ...body, quoteId: quote.quoteId, ...(quote.guestToken ? { quoteGuestToken: quote.guestToken } : {}), currency: 'USD' },
  };
}

export async function readBookingIntent(scope: Scope) {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(scope), accessibility);
    if (raw === null) return null;
    const intent = journal.parse(JSON.parse(raw));
    if (intent.owner !== scope.owner || intent.apiUrl !== scope.apiUrl) throw new Error();
    return intent;
  } catch {
    throw new Error('Chưa đọc được giao dịch đã lưu trên thiết bị. Hãy thử lại trước khi tạo đặt chỗ.');
  }
}

export async function saveBookingIntent(intent: BookingIntent) {
  try {
    await SecureStore.setItemAsync(storageKey(intent), JSON.stringify(journal.parse(intent)), accessibility);
  } catch {
    throw new Error('Không thể lưu giao dịch an toàn trên thiết bị. Vui lòng tải lại trạng thái.');
  }
}

export async function clearBookingIntent(intent: BookingIntent) {
  try {
    await SecureStore.deleteItemAsync(storageKey(intent), accessibility);
  } catch {
    throw new Error('Chưa thể dọn giao dịch đã lưu. Vui lòng kiểm tra lại trạng thái.');
  }
}

// Two instances of the create route must not start or overwrite each other's intent.
export async function withBookingIntent<T>(scope: Scope, run: () => Promise<T>) {
  return withIntentLock(storageKey(scope), run, 'Giao dịch đặt chỗ đang được kiểm tra trên thiết bị.');
}
