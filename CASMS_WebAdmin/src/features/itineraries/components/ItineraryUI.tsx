import type { ReactNode } from 'react'

import { Badge } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'

import type { ItineraryStatus } from '../model/itinerary'
import { itineraryStatusLabels } from '../model/itinerary'

export function ItineraryFrame({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}

function tone(status: ItineraryStatus) {
  if (['APPROVED', 'OPEN_FOR_SALE', 'ACTIVE', 'COMPLETED'].includes(status)) return 'success' as const
  if (['REJECTED', 'CANCELLED'].includes(status)) return 'error' as const
  if (status === 'PENDING_APPROVAL') return 'warning' as const
  return 'neutral' as const
}

export function ItineraryStatusBadge({ status }: { status: ItineraryStatus }) {
  return <Badge label={itineraryStatusLabels[status]} tone={tone(status)} />
}
