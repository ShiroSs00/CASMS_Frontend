import { createBrowserRouter, Navigate } from 'react-router'

import { AccessDeniedPage, AdminGuard, CustomerGuard, AuthConceptPage, LoginPage, SessionBoundary } from '@/features/auth'

import { CruiseSearchPage, CustomerCruiseDetailPage, TravellerDetailsPage, CabinExperiencePage, ReviewBookingPage, MyBookingsPage, BookingDetailPage, ManageBookingPage, TravellerDocumentsPage, OnlineCheckinPage, ArrivalTimePage, BoardingPassPage, PaymentContractPage, ChangeRequestPage, CustomerExperiencesPage } from '@/features/booking'

import { HomePage } from '@/features/home'
import { SupplierDetailPage, SupplierFormPage, SupplierListPage } from '@/features/suppliers'
import { ShoreExcursionDetailPage, ShoreExcursionFormPage, ShoreExcursionListPage } from '@/features/shore-excursions'
import { TourGroupDetailPage, TourGroupFormPage, TourGroupListPage } from '@/features/tour-groups'
import { CruiseDetailPage, CruiseFormPage, CruiseListPage } from '@/features/cruises'
import { IssueDetailPage, IssueFormPage, IssueListPage } from '@/features/operational-issues'
import {
  DestinationDetailPage,
  DestinationFormPage,
  DestinationListPage,
  ItineraryDetailPage,
  ItineraryFormPage,
  ItineraryListPage,
  ItineraryHistoryPage,
  PortDetailPage,
  PortFormPage,
  PortListPage,
} from '@/features/itineraries'
import {
  CruiseRegulationsPage,
  RegulationDetailPage,
  RegulationFormPage,
  RegulationListPage,
  ShipRegulationsPage,
} from '@/features/regulations'
import {
  ShipListPage, ShipDetailPage, ShipFormPage,
  DeckListPage, DeckDetailPage, DeckFormPage,
  CabinListPage, CabinDetailPage, CabinFormPage,
} from '@/features/ship-deck-cabin'

import { PublicLayout } from './layouts/PublicLayout'
import { AdminAccountLayout } from './layouts/AdminAccountLayout'
import { BookingSessionLayout } from './layouts/BookingSessionLayout'
import { ActivityListPage, ActivityDetailPage, ActivityFormPage, ActivityRegistrationPage } from '@/features/activities'
import { ServiceListPage, ProductListPage, PackageListPage, ServiceRequestListPage, ServiceDetailPage, ProductDetailPage, PackageDetailPage, ServiceRequestDetailPage, ServiceFormPage, ProductFormPage, PackageFormPage, ServiceRequestFormPage, PackageAssignmentPage } from '@/features/service-packages'
import { AdminWorkflowPage } from './pages/AdminWorkflowPage'
import { AdminBookingListPage, AdminBookingDetailPage, AdminBookingCreatePage, AdminBookingLookupPage } from './pages/AdminBookingPages'
import { BookingLookupPage } from '@/features/booking'

const adminRoutes = [
  { path: '/admin/bookings', Component: AdminBookingListPage },
  { path: '/admin/bookings/lookup', Component: AdminBookingLookupPage },
  { path: '/admin/bookings/new', Component: AdminBookingCreatePage },
  { path: '/admin/bookings/:bookingId', Component: AdminBookingDetailPage },
  { path: '/admin/activity-registrations', Component: ActivityRegistrationPage },
  { path: '/admin/package-assignments', Component: PackageAssignmentPage },
  { path: '/admin/service-requests/new', Component: ServiceRequestFormPage },
  { path: '/admin/service-requests/:id/edit', Component: ServiceRequestFormPage },
  { path: '/admin/services/new', Component: ServiceFormPage },
  { path: '/admin/services/:id/edit', Component: ServiceFormPage },
  { path: '/admin/products/new', Component: ProductFormPage },
  { path: '/admin/products/:id/edit', Component: ProductFormPage },
  { path: '/admin/service-packages/new', Component: PackageFormPage },
  { path: '/admin/service-packages/:id/edit', Component: PackageFormPage },
  { path: '/admin/itinerary-history', Component: ItineraryHistoryPage },
  { path: '/admin/activities', Component: ActivityListPage },
  { path: '/admin/activities/new', Component: ActivityFormPage },
  { path: '/admin/activities/:activityId', Component: ActivityDetailPage },
  { path: '/admin/activities/:activityId/edit', Component: ActivityFormPage },
  { path: '/admin/services', Component: ServiceListPage },
  { path: '/admin/services/:id', Component: ServiceDetailPage },
  { path: '/admin/products', Component: ProductListPage },
  { path: '/admin/products/:id', Component: ProductDetailPage },
  { path: '/admin/service-packages', Component: PackageListPage },
  { path: '/admin/service-packages/:id', Component: PackageDetailPage },
  { path: '/admin/service-requests', Component: ServiceRequestListPage },
  { path: '/admin/service-requests/:id', Component: ServiceRequestDetailPage },
  { path: '/admin/workflow', Component: AdminWorkflowPage },
  { path: '/admin/tour-groups', Component: TourGroupListPage },
  { path: '/admin/tour-groups/new', Component: TourGroupFormPage },
  { path: '/admin/tour-groups/:groupId', Component: TourGroupDetailPage },
  { path: '/admin/tour-groups/:groupId/edit', Component: TourGroupFormPage },
  { path: '/admin/shore-excursions', Component: ShoreExcursionListPage },
  { path: '/admin/shore-excursions/new', Component: ShoreExcursionFormPage },
  { path: '/admin/shore-excursions/:excursionId', Component: ShoreExcursionDetailPage },
  { path: '/admin/shore-excursions/:excursionId/edit', Component: ShoreExcursionFormPage },
  { path: '/admin', element: <Navigate to="/admin/ships" replace /> },
  { path: '/admin/suppliers', Component: SupplierListPage },
  { path: '/admin/suppliers/new', Component: SupplierFormPage },
  { path: '/admin/suppliers/:supplierId', Component: SupplierDetailPage },
  { path: '/admin/suppliers/:supplierId/edit', Component: SupplierFormPage },
  { path: '/admin/ships', Component: ShipListPage },
  { path: '/admin/ships/new', Component: ShipFormPage },
  { path: '/admin/ships/:id', Component: ShipDetailPage },
  { path: '/admin/ships/:id/edit', Component: ShipFormPage },
  { path: '/admin/decks', Component: DeckListPage },
  { path: '/admin/decks/new', Component: DeckFormPage },
  { path: '/admin/decks/:id', Component: DeckDetailPage },
  { path: '/admin/decks/:id/edit', Component: DeckFormPage },
  { path: '/admin/cabins', Component: CabinListPage },
  { path: '/admin/cabins/new', Component: CabinFormPage },
  { path: '/admin/cabins/:id', Component: CabinDetailPage },
  { path: '/admin/cabins/:id/edit', Component: CabinFormPage },
  { path: '/admin/cruises', Component: CruiseListPage },
  { path: '/admin/cruises/new', Component: CruiseFormPage },
  { path: '/admin/cruises/:cruiseId', Component: CruiseDetailPage },
  { path: '/admin/cruises/:cruiseId/edit', Component: CruiseFormPage },
  { path: '/admin/itineraries', Component: ItineraryListPage },
  { path: '/admin/itineraries/new', Component: ItineraryFormPage },
  { path: '/admin/itineraries/:itineraryId', Component: ItineraryDetailPage },
  { path: '/admin/itineraries/:itineraryId/edit', Component: ItineraryFormPage },
  { path: '/admin/ports', Component: PortListPage },
  { path: '/admin/ports/new', Component: PortFormPage },
  { path: '/admin/ports/:portId', Component: PortDetailPage },
  { path: '/admin/ports/:portId/edit', Component: PortFormPage },
  { path: '/admin/destinations', Component: DestinationListPage },
  { path: '/admin/destinations/new', Component: DestinationFormPage },
  { path: '/admin/destinations/:destinationId', Component: DestinationDetailPage },
  { path: '/admin/destinations/:destinationId/edit', Component: DestinationFormPage },
  { path: '/admin/issues', Component: IssueListPage },
  { path: '/admin/issues/new', Component: IssueFormPage },
  { path: '/admin/issues/:issueId', Component: IssueDetailPage },
  { path: '/admin/issues/:issueId/edit', Component: IssueFormPage },

  {
    path: '/admin/regulations',
    Component: RegulationListPage,
  },
  {
    path: '/admin/regulations/new',
    Component: RegulationFormPage,
  },
  {
    path: '/admin/regulations/:regulationId',
    Component: RegulationDetailPage,
  },
  {
    path: '/admin/regulations/:regulationId/edit',
    Component: RegulationFormPage,
  },
  {
    path: '/admin/ships/:shipId/regulations',
    Component: ShipRegulationsPage,
  },
  {
    path: '/admin/cruises/:cruiseId/regulations',
    Component: CruiseRegulationsPage,
  },
]

export const router = createBrowserRouter([{ Component: BookingSessionLayout, children: [{ Component: AdminAccountLayout, children: [{ Component: SessionBoundary, children: [
  { Component: AdminGuard, children: [...adminRoutes, { path: '/admin/*', element: <Navigate to="/admin" replace /> }] },
    { path: '/', Component: PublicLayout, children: [
    { index: true, Component: HomePage },
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
