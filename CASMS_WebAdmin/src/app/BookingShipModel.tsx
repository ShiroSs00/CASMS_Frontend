import { lazy, Suspense } from 'react'
import type { BookingModelContext } from '@/features/booking'
import { loadCustomerShipExplorer } from '@/features/ship-model-viewer'
import { Loading } from '@/shared/ui'
const Explorer = lazy(() => loadCustomerShipExplorer().then(module => ({ default: module.CustomerShipExplorer })))
// The existing public model is reused only for physical-cabin selection with live inventory.
export function BookingShipModelRenderer(context: BookingModelContext) {
  return <Suspense fallback={<Loading label="Đang chuẩn bị phần chọn cabin…" />}><Explorer {...context} /></Suspense>
}
