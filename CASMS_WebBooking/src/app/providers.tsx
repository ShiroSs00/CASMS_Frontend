import { RouterProvider } from 'react-router/dom'
import { BookingModelIntegration } from '@/features/booking'
import { BookingShipModelRenderer } from './CustomerShipPages'
import { router } from './router'
export function AppProviders() {
  return <BookingModelIntegration.Provider value={BookingShipModelRenderer}><RouterProvider router={router} /></BookingModelIntegration.Provider>
}
