import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { CruiseSearchPage, CustomerCruiseDetailPage, BookingLookupPage, TravellerDetailsPage, CabinExperiencePage, ReviewBookingPage, MyBookingsPage, BookingDetailPage, ManageBookingPage, CustomerExperiencesPage, TravellerDocumentsPage, OnlineCheckinPage, ArrivalTimePage, BoardingPassPage, PaymentContractPage, ChangeRequestPage } from '@/features/booking'
import { AccessDeniedPage, AdminGuard, CustomerGuard, AuthConceptPage, LoginPage, SessionBoundary } from '@/features/auth'

import { PublicLayout } from './layouts/PublicLayout'
import { AdminAccountLayout } from './layouts/AdminAccountLayout'
import { BookingSessionLayout } from './layouts/BookingSessionLayout'
import { RouteLoading } from './RouteLoading'
import { RouteErrorPage } from './RouteErrorPage'

function featurePage<T>(load: () => Promise<T>, key: keyof T) {
  return async () => ({ Component: (await load())[key] as ComponentType })
}

const adminRoutes = [
  { path: '/admin/system', lazy: featurePage(() => import('./pages/AdminSystemPage'), 'AdminSystemPage') },
  { path: '/admin/staff/:area', lazy: featurePage(() => import('./pages/AdminStaffFunctionPage'), 'AdminStaffFunctionPage') },
  { path: '/admin/bookings', lazy: featurePage(() => import('./pages/AdminBookingPages'), 'AdminBookingListPage') },
  { path: '/admin/bookings/lookup', lazy: featurePage(() => import('./pages/AdminBookingPages'), 'AdminBookingLookupPage') },
  { path: '/admin/bookings/new', lazy: featurePage(() => import('./pages/AdminBookingPages'), 'AdminBookingCreatePage') },
  { path: '/admin/bookings/:bookingId', lazy: featurePage(() => import('./pages/AdminBookingPages'), 'AdminBookingDetailPage') },
  { path: '/admin/activity-registrations', lazy: featurePage(() => import('@/features/activities'), 'ActivityRegistrationPage') },
  { path: '/admin/package-assignments', lazy: featurePage(() => import('@/features/service-packages'), 'PackageAssignmentPage') },
  { path: '/admin/service-requests/new', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceRequestFormPage') },
  { path: '/admin/service-requests/:id/edit', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceRequestFormPage') },
  { path: '/admin/services/new', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceFormPage') },
  { path: '/admin/services/:id/edit', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceFormPage') },
  { path: '/admin/products/new', lazy: featurePage(() => import('@/features/service-packages'), 'ProductFormPage') },
  { path: '/admin/products/:id/edit', lazy: featurePage(() => import('@/features/service-packages'), 'ProductFormPage') },
  { path: '/admin/service-packages/new', lazy: featurePage(() => import('@/features/service-packages'), 'PackageFormPage') },
  { path: '/admin/service-packages/:id/edit', lazy: featurePage(() => import('@/features/service-packages'), 'PackageFormPage') },
  { path: '/admin/itinerary-history', lazy: featurePage(() => import('@/features/itineraries'), 'ItineraryHistoryPage') },
  { path: '/admin/activities', lazy: featurePage(() => import('@/features/activities'), 'ActivityListPage') },
  { path: '/admin/activities/new', lazy: featurePage(() => import('@/features/activities'), 'ActivityFormPage') },
  { path: '/admin/activities/:activityId', lazy: featurePage(() => import('@/features/activities'), 'ActivityDetailPage') },
  { path: '/admin/activities/:activityId/edit', lazy: featurePage(() => import('@/features/activities'), 'ActivityFormPage') },
  { path: '/admin/services', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceListPage') },
  { path: '/admin/services/:id', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceDetailPage') },
  { path: '/admin/products', lazy: featurePage(() => import('@/features/service-packages'), 'ProductListPage') },
  { path: '/admin/products/:id', lazy: featurePage(() => import('@/features/service-packages'), 'ProductDetailPage') },
  { path: '/admin/service-packages', lazy: featurePage(() => import('@/features/service-packages'), 'PackageListPage') },
  { path: '/admin/service-packages/:id', lazy: featurePage(() => import('@/features/service-packages'), 'PackageDetailPage') },
  { path: '/admin/service-requests', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceRequestListPage') },
  { path: '/admin/service-requests/:id', lazy: featurePage(() => import('@/features/service-packages'), 'ServiceRequestDetailPage') },
  { path: '/admin/tour-groups', lazy: featurePage(() => import('@/features/tour-groups'), 'TourGroupListPage') },
  { path: '/admin/tour-groups/new', lazy: featurePage(() => import('@/features/tour-groups'), 'TourGroupFormPage') },
  { path: '/admin/tour-groups/:groupId', lazy: featurePage(() => import('@/features/tour-groups'), 'TourGroupDetailPage') },
  { path: '/admin/tour-groups/:groupId/edit', lazy: featurePage(() => import('@/features/tour-groups'), 'TourGroupFormPage') },
  { path: '/admin/shore-excursions', lazy: featurePage(() => import('@/features/shore-excursions'), 'ShoreExcursionListPage') },
  { path: '/admin/shore-excursions/new', lazy: featurePage(() => import('@/features/shore-excursions'), 'ShoreExcursionFormPage') },
  { path: '/admin/shore-excursions/:excursionId', lazy: featurePage(() => import('@/features/shore-excursions'), 'ShoreExcursionDetailPage') },
  { path: '/admin/shore-excursions/:excursionId/edit', lazy: featurePage(() => import('@/features/shore-excursions'), 'ShoreExcursionFormPage') },
  { path: '/admin', lazy: featurePage(() => import('./pages/AdminOverviewPage'), 'AdminOverviewPage') },
  { path: '/admin/suppliers', lazy: featurePage(() => import('@/features/suppliers'), 'SupplierListPage') },
  { path: '/admin/suppliers/new', lazy: featurePage(() => import('@/features/suppliers'), 'SupplierFormPage') },
  { path: '/admin/suppliers/:supplierId', lazy: featurePage(() => import('@/features/suppliers'), 'SupplierDetailPage') },
  { path: '/admin/suppliers/:supplierId/edit', lazy: featurePage(() => import('@/features/suppliers'), 'SupplierFormPage') },
  { path: '/admin/ships', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'ShipListPage') },
  { path: '/admin/ships/new', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'ShipFormPage') },
  { path: '/admin/ships/:id', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'ShipDetailPage') },
  { path: '/admin/ships/:id/edit', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'ShipFormPage') },
  { path: '/admin/decks', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'DeckListPage') },
  { path: '/admin/decks/new', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'DeckFormPage') },
  { path: '/admin/decks/:id', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'DeckDetailPage') },
  { path: '/admin/decks/:id/edit', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'DeckFormPage') },
  { path: '/admin/cabins', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'CabinListPage') },
  { path: '/admin/cabins/new', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'CabinFormPage') },
  { path: '/admin/cabins/:id', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'CabinDetailPage') },
  { path: '/admin/cabins/:id/edit', lazy: featurePage(() => import('@/features/ship-deck-cabin'), 'CabinFormPage') },
  { path: '/admin/cruises', lazy: featurePage(() => import('@/features/cruises'), 'CruiseListPage') },
  { path: '/admin/cruises/new', lazy: featurePage(() => import('@/features/cruises'), 'CruiseFormPage') },
  { path: '/admin/cruises/:cruiseId', lazy: featurePage(() => import('@/features/cruises'), 'CruiseDetailPage') },
  { path: '/admin/cruises/:cruiseId/edit', lazy: featurePage(() => import('@/features/cruises'), 'CruiseFormPage') },
  { path: '/admin/itineraries', lazy: featurePage(() => import('@/features/itineraries'), 'ItineraryListPage') },
  { path: '/admin/itineraries/new', lazy: featurePage(() => import('@/features/itineraries'), 'ItineraryFormPage') },
  { path: '/admin/itineraries/:itineraryId', lazy: featurePage(() => import('@/features/itineraries'), 'ItineraryDetailPage') },
  { path: '/admin/itineraries/:itineraryId/edit', lazy: featurePage(() => import('@/features/itineraries'), 'ItineraryFormPage') },
  { path: '/admin/ports', lazy: featurePage(() => import('@/features/itineraries'), 'PortListPage') },
  { path: '/admin/ports/new', lazy: featurePage(() => import('@/features/itineraries'), 'PortFormPage') },
  { path: '/admin/ports/:portId', lazy: featurePage(() => import('@/features/itineraries'), 'PortDetailPage') },
  { path: '/admin/ports/:portId/edit', lazy: featurePage(() => import('@/features/itineraries'), 'PortFormPage') },
  { path: '/admin/destinations', lazy: featurePage(() => import('@/features/itineraries'), 'DestinationListPage') },
  { path: '/admin/destinations/new', lazy: featurePage(() => import('@/features/itineraries'), 'DestinationFormPage') },
  { path: '/admin/destinations/:destinationId', lazy: featurePage(() => import('@/features/itineraries'), 'DestinationDetailPage') },
  { path: '/admin/destinations/:destinationId/edit', lazy: featurePage(() => import('@/features/itineraries'), 'DestinationFormPage') },
  { path: '/admin/issues', lazy: featurePage(() => import('@/features/operational-issues'), 'IssueListPage') },
  { path: '/admin/issues/new', lazy: featurePage(() => import('@/features/operational-issues'), 'IssueFormPage') },
  { path: '/admin/issues/:issueId', lazy: featurePage(() => import('@/features/operational-issues'), 'IssueDetailPage') },
  { path: '/admin/issues/:issueId/edit', lazy: featurePage(() => import('@/features/operational-issues'), 'IssueFormPage') },

  {
    path: '/admin/regulations',
    lazy: featurePage(() => import('@/features/regulations'), 'RegulationListPage'),
  },
  {
    path: '/admin/regulations/new',
    lazy: featurePage(() => import('@/features/regulations'), 'RegulationFormPage'),
  },
  {
    path: '/admin/regulations/:regulationId',
    lazy: featurePage(() => import('@/features/regulations'), 'RegulationDetailPage'),
  },
  {
    path: '/admin/regulations/:regulationId/edit',
    lazy: featurePage(() => import('@/features/regulations'), 'RegulationFormPage'),
  },
  {
    path: '/admin/ships/:shipId/regulations',
    lazy: featurePage(() => import('@/features/regulations'), 'ShipRegulationsPage'),
  },
  {
    path: '/admin/cruises/:cruiseId/regulations',
    lazy: featurePage(() => import('@/features/regulations'), 'CruiseRegulationsPage'),
  },
]

export const router = createBrowserRouter([{ ErrorBoundary: RouteErrorPage, HydrateFallback: RouteLoading, Component: BookingSessionLayout, children: [{ Component: AdminAccountLayout, children: [{ Component: SessionBoundary, children: [
  { path: '/admin/workflow', element: <Navigate to="/admin" replace /> },
  { path: '/admin/workspaces/:workspaceId', element: <Navigate to="/admin" replace /> },
  { Component: AdminGuard, children: [...adminRoutes, { path: '/admin/*', element: <Navigate to="/admin" replace /> }] },
    { path: '/', Component: PublicLayout, children: [
    { index: true, lazy: featurePage(() => import('@/features/home'), 'HomePage') },
    { path: 'cruises', Component: CruiseSearchPage },
    { path: 'cruises/:cruiseId', Component: CustomerCruiseDetailPage },
    { path: 'booking/lookup', Component: BookingLookupPage },
    { path: 'booking/travellers', Component: TravellerDetailsPage },
    { path: 'booking/cabin-experience', Component: CabinExperiencePage },
    { path: 'booking/review', Component: ReviewBookingPage },
    { Component: CustomerGuard, children: [
      { path: 'my-bookings', Component: MyBookingsPage },
      { path: 'my-bookings/:bookingId', Component: BookingDetailPage },
      { path: 'my-bookings/:bookingId/manage', Component: ManageBookingPage },
      { path: 'my-bookings/:bookingId/experiences', Component: CustomerExperiencesPage },
      { path: 'my-bookings/:bookingId/travellers', Component: TravellerDocumentsPage },
      { path: 'my-bookings/:bookingId/check-in', Component: OnlineCheckinPage },
      { path: 'my-bookings/:bookingId/arrival-time', Component: ArrivalTimePage },
      { path: 'my-bookings/:bookingId/boarding-pass', Component: BoardingPassPage },
      { path: 'my-bookings/:bookingId/payment', Component: PaymentContractPage },
      { path: 'my-bookings/:bookingId/change-request', Component: ChangeRequestPage },
    ] },
  ] },
  { path: '/login', Component: LoginPage },
    { path: '/403', Component: AccessDeniedPage },
  ...(['register', 'verify-email', 'forgot-password', 'reset-password', 'reservation-lookup', 'account-locked'] as const).map(kind => ({ path: '/' + kind, element: <AuthConceptPage key={kind} kind={kind} /> })),
] }] }] }])
