import { useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { BookingContext } from '../model/booking-context'
import { initialDraft } from '../model/booking-draft'
import { defaultScenario } from '../model/booking-scenarios'
import { initialLiveBooking, LiveBookingContext } from '../model/live-booking-context'
import type { BookingDetail } from '../api/real-booking-api'

export function BookingProvider() {
  const [draft, setDraft] = useState(initialDraft)
  const [scenario, setScenario] = useState(defaultScenario)
  const [liveDraft, setLiveDraft] = useState(initialLiveBooking)
  const [saved, setSaved] = useState<BookingDetail | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submissionLockRef = useRef(false)

  return (
    <BookingContext.Provider value={{ draft, setDraft, scenario, setScenario }}>
      <LiveBookingContext value={{ draft: liveDraft, setDraft: setLiveDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError, setSubmitError, errors, setErrors, submissionLockRef }}><Outlet /></LiveBookingContext>
    </BookingContext.Provider>
  )
}
