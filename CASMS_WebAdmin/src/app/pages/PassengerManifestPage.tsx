import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router'
import { DepartureManifestWorkspace } from '@/domain/cruise-manifest'
import { loadPassengerTrackingPage } from '@/features/ship-model-viewer'
import { ButtonLink, Loading, PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { useSessionAccess } from '@/shared/auth'

const LocationLookup=lazy(()=>loadPassengerTrackingPage().then(module=>({default:module.PassengerTrackingPage})))
export function PassengerManifestPage() {
  const [params]=useSearchParams(),access=useSessionAccess()
  const canLocate=access.canDo('BLE_TELEMETRY_READ')&&access.canDo('SHIP_READ')
  const query=new URLSearchParams(params);query.delete('view')
  if (params.get('view') === 'location' && canLocate) {
    const backQuery = query.toString()
    return <Suspense fallback={<Loading label="Đang tải tra cứu vị trí…"/>}>
      <LocationLookup backTo={backQuery ? `?${backQuery}` : '?'} />
    </Suspense>
  }
  query.set('view','location')
  return <AdminShell>
    <PageHeader title="Hành khách trên tàu" breadcrumb="HÀNH KHÁCH"
      actions={canLocate && <ButtonLink to={`?${query}`}>Tra cứu vị trí hành khách</ButtonLink>} />
    <DepartureManifestWorkspace/>
  </AdminShell>
}
