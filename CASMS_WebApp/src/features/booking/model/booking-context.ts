import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { BookingDraft } from './booking-types'
export const BookingContext=createContext<{draft:BookingDraft;setDraft:Dispatch<SetStateAction<BookingDraft>>}|null>(null)
export function useBookingDraft() { const context=useContext(BookingContext); if(!context) throw new Error('BookingProvider required'); return context }

