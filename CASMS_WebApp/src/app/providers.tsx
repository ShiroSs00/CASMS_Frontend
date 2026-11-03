import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '@/features/auth'
import { BookingModelIntegration } from '@/features/booking'
import {renderBookingShipModel} from './CustomerShipPages'

import { router } from './router'

export function AppProviders() {
  return <AuthProvider><BookingModelIntegration.Provider value={renderBookingShipModel}><RouterProvider router={router} /></BookingModelIntegration.Provider></AuthProvider>
}
