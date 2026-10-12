import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/features/home'
import { IssueDetailPage, IssueListPage } from '@/features/operational-issues'

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
    path: '/admin/issues',
    Component: IssueListPage,
  },
  {
    path: '/admin/issues/:issueId',
    Component: IssueDetailPage,
  },
])
