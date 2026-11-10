import { createContext, useContext, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { BookingDetail, BookingDraft, BookingPersonDraft } from '../api/real-booking-api'
import type { BookingQuoteIntent } from '../api/booking-quote-api'

export const blankBookingPerson = (): BookingPersonDraft => ({ fullName: '', dateOfBirth: '', nationality: '', documentType: '', documentNumber: '', email: '', phoneNumber: '', cabinId: '', tourPackageId: '' })
export const initialLiveBooking = (): BookingDraft => ({ cruiseId: '', currency: 'USD', paymentPlan: 'STAGES', notes: '', passengers: [{ ...blankBookingPerson(), cabinGroupKey: 'BOOKING_GROUP' }] })
type LiveBookingState = {
  draft: BookingDraft; setDraft: Dispatch<SetStateAction<BookingDraft>>
  saved: BookingDetail | null; setSaved: Dispatch<SetStateAction<BookingDetail | null>>
  uncertain: boolean; setUncertain: Dispatch<SetStateAction<boolean>>
  busy: boolean; setBusy: Dispatch<SetStateAction<boolean>>
  submitError: string; setSubmitError: Dispatch<SetStateAction<string>>
  errors: Record<string, string>; setErrors: Dispatch<SetStateAction<Record<string, string>>>
  submissionLockRef: MutableRefObject<boolean>
  quoteIntent: BookingQuoteIntent | null; setQuoteIntent: Dispatch<SetStateAction<BookingQuoteIntent | null>>
  quoteUnknown: boolean; setQuoteUnknown: Dispatch<SetStateAction<boolean>>
  partyConfirmed: boolean; setPartyConfirmed: Dispatch<SetStateAction<boolean>>
  personIds: string[]; setPersonIds: Dispatch<SetStateAction<string[]>>
}
export const LiveBookingContext = createContext<LiveBookingState | null>(null)
export function useLiveBooking() {
  const value = useContext(LiveBookingContext)
  if (!value) throw new Error('BookingProvider required')
  return value
}
