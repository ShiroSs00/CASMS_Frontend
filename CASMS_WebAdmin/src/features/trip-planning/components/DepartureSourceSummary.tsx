import { ButtonLink, PermissionLink as Link } from '@/shared/ui'
import { usePlanning } from '../hooks'
import type { Trip, Version } from '../model/plan'
import styles from '../Planning.module.css'

export function DepartureSourceSummary({trip,version}:{trip:Trip;version:Version}) {
  const {can}=usePlanning()
  if(version.status!=='PUBLISHED')return null
  return <section className={styles.departureSource} aria-labelledby="schedule-next-step">
    <div><h2 id="schedule-next-step">Đã tạo mẫu lịch trình</h2><p>{trip.name} · {version.days.length} ngày</p>{can('CRUISE_CREATE')&&<span>Chọn ngày khởi hành để tạo chuyến khởi hành từ mẫu này.</span>}</div>
    <div className={styles.actions}>
     {can('CRUISE_READ')&&<Link to={'/admin/cruises?'+new URLSearchParams({sourceTripId:trip.tripId,sourceVersionId:version.versionId})}>Xem chuyến từ mẫu này</Link>}
     {can('CRUISE_CREATE')&&<ButtonLink to={'/admin/cruises/new?sourceVersionId='+encodeURIComponent(version.versionId)}>Tạo chuyến khởi hành</ButtonLink>}
    </div>
  </section>
}
