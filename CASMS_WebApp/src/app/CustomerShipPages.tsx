import { lazy, Suspense } from 'react'
import { CabinExperiencePage, type BookingModelContext } from '@/features/booking'
import { Loading } from '@/shared/ui'

const Ships = lazy(() => import('@/features/home').then(module => ({ default: module.ShipsPage })))
const Explorer = lazy(() => import('@/features/ship-model-viewer').then(module => ({ default: module.CustomerShipExplorer })))
const Fleet = lazy(() => import('@/features/ship-model-viewer').then(module => ({ default: module.CustomerFleetExplorer })))
function renderModel(context: BookingModelContext) {
  return <Suspense fallback={<Loading label="Đang chuẩn bị phần xem tàu…" />}><Explorer {...context} /></Suspense>
}
export function CustomerCabinExperiencePage() { return <CabinExperiencePage renderShipModel={renderModel} /> }
export function CustomerShipsPage() { return <Suspense fallback={<Loading label="Đang tải trang tàu…" />}><Ships explorer={<Suspense fallback={<Loading label="Đang chuẩn bị phần khám phá tàu…" />}><Fleet /></Suspense>} /></Suspense> }
