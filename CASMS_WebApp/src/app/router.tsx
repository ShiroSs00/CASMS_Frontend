import { createBrowserRouter, Navigate } from 'react-router'

import { HomePage } from '@/features/home'
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

export const router = createBrowserRouter([
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
  {
    path: '/',
    Component: PublicLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
    ],
  },
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
])
