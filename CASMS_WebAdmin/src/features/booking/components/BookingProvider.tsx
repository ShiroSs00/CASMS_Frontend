import { useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { initialLiveBooking, LiveBookingContext } from '../model/live-booking-context'
import type { BookingDetail } from '../api/real-booking-api'

export function BookingProvider() {
  const [liveDraft, setLiveDraft] = useState(initialLiveBooking)
  const [saved, setSaved] = useState<BookingDetail | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submissionLockRef = useRef(false)

  return (
    <LiveBookingContext value={{ draft: liveDraft, setDraft: setLiveDraft, saved, setSaved, uncertain, setUncertain, busy, setBusy, submitError, setSubmitError, errors, setErrors, submissionLockRef }}><Outlet /></LiveBookingContext>
  )
}
