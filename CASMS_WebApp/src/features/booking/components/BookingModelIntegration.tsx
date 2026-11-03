import {createContext,useContext} from 'react'
import type {BookingModelRenderer} from './BookingShipModel'

/** App composition owns the renderer. Booking only supplies real Backend cabin choices and receives cabinId. */
export const BookingModelIntegration=createContext<BookingModelRenderer|null>(null)
export function useBookingModelRenderer(){return useContext(BookingModelIntegration)}
