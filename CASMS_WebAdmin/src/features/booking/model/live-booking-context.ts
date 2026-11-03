import { createContext, useContext, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { BookingDetail, BookingDraft, BookingPersonDraft } from '../api/real-booking-api'

export const blankBookingPerson = (): BookingPersonDraft => ({ fullName: '', dateOfBirth: '', nationality: '', documentType: '', documentNumber: '', email: '', phoneNumber: '', cabinId: '', tourPackageId: '' })
export const initialLiveBooking = (): BookingDraft => ({ cruiseId: '', currency: 'USD', paymentPlan: 'STAGES', notes: '', passengers: [blankBookingPerson()] })
type LiveBookingState = {
  draft: BookingDraft; setDraft: Dispatch<SetStateAction<BookingDraft>>
  saved: BookingDetail | null; setSaved: Dispatch<SetStateAction<BookingDetail | null>>
  uncertain: boolean; setUncertain: Dispatch<SetStateAction<boolean>>
  busy: boolean; setBusy: Dispatch<SetStateAction<boolean>>
  submitError: string; setSubmitError: Dispatch<SetStateAction<string>>
  errors: Record<string, string>; setErrors: Dispatch<SetStateAction<Record<string, string>>>
  submissionLockRef: MutableRefObject<boolean>
}
export const LiveBookingContext = createContext<LiveBookingState | null>(null)
export function useLiveBooking() {
  const value = useContext(LiveBookingContext)
  if (!value) throw new Error('BookingProvider required')
  return value
}
