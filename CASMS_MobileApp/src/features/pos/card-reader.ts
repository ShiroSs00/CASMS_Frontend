import { cardIdentifier } from '../passenger-actions/card-contracts';

export type NfcPort = {
  supported(): Promise<boolean>; enabled(): Promise<boolean>; start(): Promise<void>;
  request(): Promise<unknown>; tag(): Promise<{ id?: string; tech?: string } | null>; cancel(): Promise<void>;
};
type ReadFailure = 'unavailable' | 'unsupported' | 'disabled' | 'cancelled' | 'busy' | 'invalid' | 'read';
export class CardReadError extends Error {
  reason: ReadFailure;
  constructor(reason: ReadFailure) { super(reason); this.reason = reason; }
}
export function normalizeCardTag(tag: { id?: string; tech?: string } | null) {
  if (!tag || tag.tech === 'felica' || !cardIdentifier.safeParse(tag.id).success) throw new CardReadError('invalid');
  return tag.id!.toUpperCase();
}
/** One foreground native session; cancellation also invalidates a pending module load. */
export function createCardReader(load: () => Promise<NfcPort>) {
  let busy = false, generation = 0;
  let port: NfcPort | undefined;
  return {
    async read() {
      if (busy) throw new CardReadError('busy');
      busy = true;
      const version = ++generation;
      const current = () => { if (generation !== version) throw new CardReadError('cancelled'); };
      let requested = false;
      try {
        port = await load(); current();
        if (!await port.supported()) throw new CardReadError('unsupported');
        current(); await port.start(); current();
        if (!await port.enabled()) throw new CardReadError('disabled');
        current(); requested = true; await port.request(); current();
        const tag = await port.tag(); current();
        return normalizeCardTag(tag);
      } finally {
        try { if (requested) await port?.cancel(); } finally { busy = false; }
      }
    },
    async cancel() { generation++; await port?.cancel(); },
  };
}
