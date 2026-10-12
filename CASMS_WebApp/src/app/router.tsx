import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/features/home'
import {
  CruiseRegulationsPage,
  RegulationDetailPage,
  RegulationFormPage,
  RegulationListPage,
  ShipRegulationsPage,
} from '@/features/regulations'

import { PublicLayout } from './layouts/PublicLayout'

export const router = createBrowserRouter([
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
