import { useCallback, useRef, useState, type SetStateAction } from 'react'
import { Outlet } from 'react-router'
import { initialLiveBooking, LiveBookingContext } from '../model/live-booking-context'
import type { BookingDetail, BookingDraft } from '../api/real-booking-api'
import type { BookingQuoteIntent } from '../api/booking-quote-api'
import { updateSelection } from '../model/booking-transaction'

export function BookingProvider() {
  const [selection, setSelection] = useState<{ draft: BookingDraft; intent: BookingQuoteIntent | null }>(() => ({ draft: initialLiveBooking(), intent: null }))
  const setLiveDraft = useCallback((update: SetStateAction<BookingDraft>) => setSelection(s => updateSelection(s, update)), [])
  const setQuoteIntent = useCallback((update: SetStateAction<BookingQuoteIntent | null>) => setSelection(s => ({ ...s, intent: typeof update === 'function' ? update(s.intent) : update })), [])
  const [saved, setSaved] = useState<BookingDetail | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submissionLockRef = useRef(false)
  const [quoteUnknown, setQuoteUnknown] = useState(false)
  const [partyConfirmed, setPartyConfirmed] = useState(false)
  const [personIds, setPersonIds] = useState<string[]>(() => [crypto.randomUUID()])

  return (
    <LiveBookingContext value={{ draft: selection.draft, setDraft: setLiveDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError, setSubmitError, errors, setErrors, submissionLockRef, quoteIntent: selection.intent, setQuoteIntent, quoteUnknown, setQuoteUnknown, partyConfirmed, setPartyConfirmed, personIds, setPersonIds }}><Outlet /></LiveBookingContext>
  )
}
