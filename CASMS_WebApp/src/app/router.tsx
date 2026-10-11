import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/features/home'

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
])
