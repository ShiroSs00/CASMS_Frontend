import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { CruiseSearchPage, CustomerCruiseDetailPage, BookingPartyPage, BookingLookupPage, TravellerDetailsPage, ReviewBookingPage } from '@/features/booking'
import { CustomerCabinExperiencePage, CustomerShipsPage } from './CustomerShipPages'
import { CustomerRecoveryRedirect } from './CustomerRecoveryRedirect'
import { PublicLayout } from './layouts/PublicLayout'
import { BookingSessionLayout } from './layouts/BookingSessionLayout'
import { RouteLoading } from './RouteLoading'
import { RouteErrorPage } from './RouteErrorPage'
function featurePage<T>(load: () => Promise<T>, key: keyof T) {
  return async () => ({ Component: (await load())[key] as ComponentType })
}
export const router = createBrowserRouter([{
  ErrorBoundary: RouteErrorPage, HydrateFallback: RouteLoading, Component: BookingSessionLayout,
  children: [{ path: '/', Component: PublicLayout, children: [
    { index: true, lazy: featurePage(() => import('@/features/home'), 'HomePage') },
    { path: 'destinations', lazy: featurePage(() => import('@/features/home'), 'DestinationsPage') },
    { path: 'ships', Component: CustomerShipsPage },
    { path: 'deals', lazy: featurePage(() => import('@/features/home'), 'DealsPage') },
    { path: 'cruises', Component: CruiseSearchPage },
    { path: 'cruises/:cruiseId', Component: CustomerCruiseDetailPage },
    { path: 'booking/lookup', Component: BookingLookupPage },
    { path: 'booking/party', Component: BookingPartyPage },
    { path: 'booking/travellers', Component: TravellerDetailsPage },
    { path: 'booking/cabin-experience', Component: CustomerCabinExperiencePage },
    { path: 'booking/review', Component: ReviewBookingPage },
    { path: 'my-bookings', Component: CustomerRecoveryRedirect },
    { path: 'my-bookings/:bookingId/*', Component: CustomerRecoveryRedirect },
    ...['login', 'register', 'verify-email', 'forgot-password', 'reset-password', 'reservation-lookup', 'account-locked'].map(path => ({ path, Component: CustomerRecoveryRedirect })),
  ] }],
}])
