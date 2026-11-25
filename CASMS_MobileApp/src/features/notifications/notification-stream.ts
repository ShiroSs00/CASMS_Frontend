import { z } from 'zod';
import { notificationSchema, countSchema } from './notification-contracts';
export type StreamEvent = { name: string; data: string };
export function createSseParser(emit: (event: StreamEvent) => void) {
  let buffer = '', name = '', lines: string[] = [], size = 0;
  return (chunk: string) => {
    buffer += chunk;
    if (buffer.length + size > 262144) throw new Error('SSE frame too large');
    let match: RegExpExecArray | null;
    while ((match = /\r\n|\n|\r(?!$)/.exec(buffer))) {
      const line = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
      if (!line) { if (lines.length) emit({ name: name || 'message', data: lines.join('\n') }); name = ''; lines = []; size = 0; }
      else if (!line.startsWith(':')) {
        const colon = line.indexOf(':'), field = colon < 0 ? line : line.slice(0,colon);
        const value = colon < 0 ? '' : line.slice(colon+1).replace(/^ /,'');
        if (field === 'event') name = value;
        if (field === 'data') { lines.push(value); size += value.length; }
        if (size > 262144) throw new Error('SSE frame too large');
      }
    }
  };
}
export function decodeStreamEvent(event: StreamEvent) {
  if (!['connected','notification','unread-count'].includes(event.name)) return null;
  try {
    const value: unknown = JSON.parse(event.data);
    if (event.name === 'connected') return z.object({ connected: z.literal(true) }).safeParse(value).success ? { kind: 'connected' as const } : null;
    if (event.name === 'unread-count') return z.object({ unreadCount: countSchema }).safeParse(value).success ? { kind: 'inbox' as const } : null;
    const parsed = z.object({ notification: notificationSchema, unreadCount: countSchema }).safeParse(value);
    return parsed.success ? { kind: 'notification' as const, notification: parsed.data.notification } : null;
  } catch { return null; }
}
export type SyncStatus = 'connecting' | 'live' | 'retrying' | 'fallback' | 'denied' | 'paused';
type Timer = ReturnType<typeof setTimeout>;
export function startNotificationStream(options: {
  baseUrl: string; token: string; current: () => boolean;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  invalidate: (kind: 'inbox' | 'all' | 'auth') => void;
  status: (status: SyncStatus) => void;
  schedule?: (work: () => void, ms: number) => Timer; cancel?: (timer: Timer) => void;
  random?: () => number;
}) {
  const schedule = options.schedule ?? setTimeout, cancel = options.cancel ?? clearTimeout;
  let stopped = false, attempts = 0, authDenied = false, controller: AbortController | undefined;
  const timers = new Set<Timer>(), seen = new Set<string>(); let coalesce: Timer | undefined;
  let pendingKind: 'all' | 'inbox' = 'inbox'; let cancelReader: (() => void) | undefined;
  const valid = () => !stopped && options.current();
  function later(work: () => void, ms: number) {
    const timer = schedule(() => { timers.delete(timer); if (valid()) work(); }, ms); timers.add(timer); return timer;
  }
  function status(value: SyncStatus) { if (valid()) options.status(value); }
  function invalidate(kind: 'inbox' | 'all' | 'auth') { if (valid()) options.invalidate(kind); }
  function reconcile() { if (authDenied) return; invalidate('all'); later(reconcile, 60000); }
  function queue(kind: 'all' | 'inbox' = 'inbox') {
    if (kind === 'all') pendingKind = 'all';
    if (coalesce !== undefined) return;
    coalesce = later(() => { coalesce = undefined; invalidate(pendingKind); pendingKind = 'inbox'; }, 250);
  }
  async function connect() {
    if (!valid() || authDenied) return;
    controller = new AbortController(); const activeController = controller;
    status(attempts ? 'retrying' : 'connecting');
    // The hub sends no heartbeat. Silence after `connected` is healthy, not a
    // network failure. Bound the handshake separately from its 30-minute lease.
    let established = false;
    const handshake = later(() => activeController.abort(), 45000);
    const lease = later(() => activeController.abort(), 30 * 60 * 1000);
    let stable: Timer | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await options.fetch(`${options.baseUrl}/notifications/stream`, { method: 'GET', credentials: 'omit', redirect: 'error', headers: { Authorization: `Bearer ${options.token}`, Accept: 'text/event-stream' }, signal: activeController.signal });
      if (!valid()) return;
      if ([401,403].includes(response.status)) { authDenied = true; status('denied'); invalidate('auth'); return; }
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/event-stream') || !response.body) throw new Error('SSE unavailable');
      reader = response.body.getReader();
      cancelReader = () => { void reader?.cancel().catch(() => {}); };
      const decoder = new TextDecoder();
      const parse = createSseParser(raw => {
        if (!valid() || activeController.signal.aborted) return;
        const event = decodeStreamEvent(raw); if (!event) return;
        if (event.kind === 'connected') {
          if (established) return;
          established = true;
          cancel(handshake); timers.delete(handshake);
          // A short-lived accepted stream must not reset the failure budget.
          stable = later(() => { attempts = 0; }, 60000);
          status('live'); queue('all'); return;
        }
        if (event.kind === 'notification') {
          const row = event.notification, key = `${row.notificationId}:${row.createdAt}:${row.readAt ?? ''}`;
          if (seen.has(key)) return;
          seen.add(key); if (seen.size > 256) seen.delete(seen.values().next().value!);
          // Only the verified schedule type has a business-query mapping.
          if (row.notificationType === 'CRUISE_SCHEDULE_CHANGE') { queue('all'); return; }
        }
        queue();
      });
      while (valid() && !activeController.signal.aborted) {
        const chunk = await reader.read(); if (chunk.done) break;
        parse(decoder.decode(chunk.value, { stream: true }));
      }
    } catch { /* REST remains authoritative; never log payloads or replay writes. */ }
    finally {
      activeController.abort();
      for (const timer of [handshake, lease, stable]) {
        if (timer !== undefined) { cancel(timer); timers.delete(timer); }
      }
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    if (!valid() || authDenied) return;
    invalidate('all');
    if (++attempts >= 5) { status('fallback'); return; }
    status('retrying');
    later(() => { void connect(); }, Math.min(30000, 1000 * 2 ** (attempts - 1)) * (.8 + .4 * (options.random ?? Math.random)()));
  }
  invalidate('all'); later(reconcile, 60000); void connect();
  return () => { stopped = true; controller?.abort(); cancelReader?.(); for (const timer of timers) cancel(timer); timers.clear(); seen.clear(); };
}
