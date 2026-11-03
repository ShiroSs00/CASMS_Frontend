import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '@/features/auth'
import { BookingModelIntegration } from '@/features/booking'
import { BookingShipModelRenderer } from './BookingShipModel'

import { router } from './router'

export function AppProviders() {
  return <AuthProvider><BookingModelIntegration.Provider value={BookingShipModelRenderer}><RouterProvider router={router} /></BookingModelIntegration.Provider></AuthProvider>
}
