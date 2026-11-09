import { bookingWasRejected } from './booking-policy';
import type { BookingIntent } from './booking-recovery';
import type { BookingDetail } from './passenger-types';

type Recovery = { state: 'completed'; booking: BookingDetail } | { state: 'not-recorded' | 'processing' };
type Ports = {
  read: () => Promise<BookingIntent | null>;
  save: (intent: BookingIntent) => Promise<void>;
  clear: (intent: BookingIntent) => Promise<void>;
  prepare: () => BookingIntent;
  create: (intent: BookingIntent) => Promise<BookingDetail>;
  recover: (intent: BookingIntent) => Promise<Recovery>;
  current: () => void;
  changed: (intent: BookingIntent | null) => void;
};

/** Run under the per-owner intent lock. Never infer failure from absence of a response. */
export async function processBookingIntent(operation: 'create' | 'lookup' | 'retry' | 'discard', ports: Ports): Promise<Recovery | null> {
  let saved = await ports.read();
  ports.current();
  ports.changed(saved);
  if (operation === 'create' && !saved) {
    saved = ports.prepare();
    await ports.save(saved); // Persist before any HTTP mutation.
    ports.current();
    ports.changed(saved);
  } else {
    if (!saved) return null;
    const result = await ports.recover(saved);
    ports.current();
    if (result.state !== 'not-recorded') return result;
    if (operation === 'discard' && saved.rejected) {
      await ports.clear(saved);
      ports.changed(null);
      return null;
    }
    if (operation !== 'retry' || saved.rejected) return result;
  }
  const pending = saved;
  try {
    ports.current();
    const booking = await ports.create(pending);
    ports.current();
    return { state: 'completed', booking };
  } catch (error) {
    if (bookingWasRejected(error)) {
      const rejected = { ...pending, rejected: true };
      await ports.save(rejected);
      ports.changed(rejected);
    }
    throw error;
  }
}
