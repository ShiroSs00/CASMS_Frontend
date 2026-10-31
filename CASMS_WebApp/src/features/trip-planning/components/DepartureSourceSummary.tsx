import { ButtonLink, PermissionLink as Link } from '@/shared/ui'
import { usePlanning } from '../hooks'
import type { Trip, Version } from '../model/plan'
import styles from '../Planning.module.css'

export function DepartureSourceSummary({trip,version}:{trip:Trip;version:Version}) {
  const {can}=usePlanning()
  if(version.status!=='PUBLISHED'||!can('CRUISE_READ'))return null
  return <section className={styles.departureSource} aria-label="Chuyến khởi hành từ lịch trình mẫu">
    <div><h2>Chuyến khởi hành</h2><p>{trip.name}</p><span>Áp dụng mẫu đã chốt, phiên bản {version.versionNumber}</span></div>
    <div className={styles.actions}>
     <Link to={'/admin/cruises?'+new URLSearchParams({sourceTripId:trip.tripId,sourceVersionId:version.versionId})}>Xem các chuyến khởi hành</Link>
     {can('CRUISE_CREATE')&&<ButtonLink to={'/admin/cruises/new?sourceVersionId='+encodeURIComponent(version.versionId)}>Tạo chuyến khởi hành</ButtonLink>}
    </div>
  </section>
}
