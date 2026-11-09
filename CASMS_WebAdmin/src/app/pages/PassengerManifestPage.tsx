import { lazy, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DepartureManifestWorkspace } from '@/domain/cruise-manifest'
import { loadPassengerTrackingPage } from '@/features/ship-model-viewer'
import { Loading, PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { useSessionAccess } from '@/shared/auth'

const LocationLookup=lazy(()=>loadPassengerTrackingPage().then(module=>({default:module.PassengerTrackingPage})))
export function PassengerManifestPage() {
  const [params]=useSearchParams(),access=useSessionAccess()
  const canLocate=access.canDo('BLE_TELEMETRY_READ')&&access.canDo('SHIP_READ')
  const query=new URLSearchParams(params);query.delete('view')
  if(params.get('view')==='location'&&canLocate)return <><Link to={`?${query}`} preventScrollReset>Tra cứu hành khách theo chuyến</Link><Suspense fallback={<Loading label="Đang tải tra cứu vị trí…"/>}><LocationLookup/></Suspense></>
  query.set('view','location')
  return <AdminShell><PageHeader title="Hành khách trên tàu" breadcrumb="HÀNH KHÁCH"/>
    {canLocate&&<Link to={`?${query}`} preventScrollReset>Tra cứu vị trí theo tàu</Link>}
    <DepartureManifestWorkspace/>
  </AdminShell>
}
