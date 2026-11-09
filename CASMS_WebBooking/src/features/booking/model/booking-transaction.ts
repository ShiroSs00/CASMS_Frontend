import type { SetStateAction } from 'react'
import type { BookingDraft } from '../api/real-booking-api'
import { quoteSelection, type BookingQuoteIntent } from '../api/booking-quote-api'

/** Clock seam for event-time checks; never called by presentation during render. */
export const bookingNow = () => Date.now()

export function quoteUsable(draft: BookingDraft, intent: BookingQuoteIntent | null, now = Date.now()) {
  return Boolean(intent && intent.selection === quoteSelection(draft) && intent.quote.status === 'ACTIVE'
    && intent.quote.expiresAt && Date.parse(intent.quote.expiresAt) > now)
}
export function updateSelection(session: { draft: BookingDraft; intent: BookingQuoteIntent | null }, update: SetStateAction<BookingDraft>) {
  const draft = typeof update === 'function' ? update(session.draft) : update
  return { draft, intent: quoteSelection(draft) === quoteSelection(session.draft) ? session.intent : null }
}
export function transactionState({ busy, quoteUnknown, uncertain, saved }: { busy: boolean; quoteUnknown: boolean; uncertain: boolean; saved: unknown }) {
  if (saved) return 'received'
  if (uncertain) return 'booking-unknown'
  if (quoteUnknown) return 'quote-unknown'
  return busy ? 'pending' : 'editable'
}
