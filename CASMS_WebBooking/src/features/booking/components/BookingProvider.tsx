import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { Outlet } from 'react-router'
import { initialLiveBooking, LiveBookingContext } from '../model/live-booking-context'
import type { BookingDetail, BookingDraft } from '../api/real-booking-api'
import type { BookingQuoteIntent } from '../api/booking-quote-api'
import { updateSelection } from '../model/booking-transaction'

const DRAFT_STORAGE_KEY = 'ocevie:booking-draft:v1'

type PersistedDraft = {
  draft: BookingDraft
  partyConfirmed: boolean
  personIds: string[]
}

function readPersistedDraft(): PersistedDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedDraft>
    if (!parsed.draft || !Array.isArray(parsed.draft.passengers) || parsed.draft.passengers.length === 0) return null
    const personIds = Array.isArray(parsed.personIds) && parsed.personIds.length === parsed.draft.passengers.length
      ? parsed.personIds
      : parsed.draft.passengers.map(() => crypto.randomUUID())
    return { draft: parsed.draft, partyConfirmed: Boolean(parsed.partyConfirmed), personIds }
  } catch {
    return null
  }
}

function clearPersistedDraft() {
  try { window.sessionStorage.removeItem(DRAFT_STORAGE_KEY) } catch { /* ignore storage errors */ }
}

export function BookingProvider() {
  const [selection, setSelection] = useState<{ draft: BookingDraft; intent: BookingQuoteIntent | null }>(() => {
    const restored = readPersistedDraft()
    return { draft: restored?.draft ?? initialLiveBooking(), intent: null }
  })
  const setLiveDraft = useCallback((update: SetStateAction<BookingDraft>) => setSelection(s => updateSelection(s, update)), [])
  const setQuoteIntent = useCallback((update: SetStateAction<BookingQuoteIntent | null>) => setSelection(s => ({ ...s, intent: typeof update === 'function' ? update(s.intent) : update })), [])
  const [saved, setSaved] = useState<BookingDetail | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submissionLockRef = useRef(false)
  const [quoteUnknown, setQuoteUnknown] = useState(false)
  const [partyConfirmed, setPartyConfirmed] = useState(() => readPersistedDraft()?.partyConfirmed ?? false)
  const [personIds, setPersonIds] = useState<string[]>(() => readPersistedDraft()?.personIds ?? [crypto.randomUUID()])

  // BKG-UX-06: Persist booking wizard draft in sessionStorage across reloads; clear once completed.
  useEffect(() => {
    if (saved) {
      clearPersistedDraft()
      return
    }
    try {
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ draft: selection.draft, partyConfirmed, personIds }),
      )
    } catch { /* ignore quota/private-mode errors */ }
  }, [selection.draft, partyConfirmed, personIds, saved])

  useEffect(() => {
    const onLogout = () => {
      clearPersistedDraft()
      setSelection({ draft: initialLiveBooking(), intent: null })
      setSaved(null)
      setUncertain(false)
      setBusy(false)
      setSubmitError('')
      setErrors({})
      submissionLockRef.current = false
      setQuoteUnknown(false)
      setPartyConfirmed(false)
      setPersonIds([crypto.randomUUID()])
    }
    window.addEventListener('ocevie:customer-logout', onLogout)
    return () => window.removeEventListener('ocevie:customer-logout', onLogout)
  }, [])

  return (
    <LiveBookingContext value={{ draft: selection.draft, setDraft: setLiveDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError, setSubmitError, errors, setErrors, submissionLockRef, quoteIntent: selection.intent, setQuoteIntent, quoteUnknown, setQuoteUnknown, partyConfirmed, setPartyConfirmed, personIds, setPersonIds }}><Outlet /></LiveBookingContext>
  )
}
