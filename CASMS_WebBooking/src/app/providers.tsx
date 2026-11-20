import { RouterProvider } from 'react-router/dom'
import { BookingModelIntegration } from '@/features/booking'
import { CustomerAuthProvider } from '@/features/customer-auth'
import { BookingShipModelRenderer } from './CustomerShipPages'
import { router } from './router'

export function AppProviders() {
  return (
    <CustomerAuthProvider>
      <BookingModelIntegration.Provider value={BookingShipModelRenderer}>
        <RouterProvider router={router} />
      </BookingModelIntegration.Provider>
    </CustomerAuthProvider>
  )
}
