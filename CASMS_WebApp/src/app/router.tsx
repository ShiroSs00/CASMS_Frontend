import { createBrowserRouter, Navigate } from 'react-router'

import { AccessDeniedPage, AdminGuard, CustomerGuard, AuthConceptPage, LoginPage, SessionBoundary } from '@/features/auth'

import { BookingProvider, CruiseSearchPage, CustomerCruiseDetailPage, TravellerDetailsPage, CabinExperiencePage, ReviewBookingPage, MyBookingsPage, BookingDetailPage, ManageBookingPage, TravellerDocumentsPage, OnlineCheckinPage, ArrivalTimePage, BoardingPassPage, PaymentContractPage, ChangeRequestPage } from '@/features/booking'

import { HomePage } from '@/features/home'
import { CruiseDetailPage, CruiseFormPage, CruiseListPage } from '@/features/cruises'
import { IssueDetailPage, IssueFormPage, IssueListPage } from '@/features/operational-issues'
import {
  DestinationDetailPage,
  DestinationFormPage,
  DestinationListPage,
  ItineraryDetailPage,
  ItineraryFormPage,
  ItineraryListPage,
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

const adminRoutes = [
  { path: '/admin', element: <Navigate to="/admin/ships" replace /> },
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

export const router = createBrowserRouter([{ Component: BookingProvider, children: [{ Component: SessionBoundary, children: [
  { Component: AdminGuard, children: [...adminRoutes, { path: '/admin/*', element: <Navigate to="/admin" replace /> }] },
    { path: '/', Component: PublicLayout, children: [
    { index: true, Component: HomePage },
    { path: 'cruises', Component: CruiseSearchPage },
    { path: 'cruises/:cruiseId', Component: CustomerCruiseDetailPage },
    { path: 'booking/travellers', Component: TravellerDetailsPage },
    { path: 'booking/cabin-experience', Component: CabinExperiencePage },
    { path: 'booking/review', Component: ReviewBookingPage },
    { Component: CustomerGuard, children: [
      { path: 'my-bookings', Component: MyBookingsPage },
      { path: 'my-bookings/:bookingId', Component: BookingDetailPage },
      { path: 'my-bookings/:bookingId/manage', Component: ManageBookingPage },
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
] }] }])
