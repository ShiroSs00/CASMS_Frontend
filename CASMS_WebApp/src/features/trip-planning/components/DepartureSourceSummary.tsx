import { ButtonLink, PermissionLink as Link } from '@/shared/ui'
import { usePlanning } from '../hooks'
import type { Trip, Version } from '../model/plan'
import styles from '../Planning.module.css'

export function DepartureSourceSummary({trip,version}:{trip:Trip;version:Version}) {
  const {can}=usePlanning()
  if(version.status!=='PUBLISHED'||!can('CRUISE_READ'))return null
  return <details className={styles.note}><summary>Chuẩn bị lần khởi hành</summary>
    <p><strong>{trip.name} · Phiên bản {version.versionNumber}</strong></p>
    <p>Liên kết phiên bản này với lần khởi hành mới. Ngày giờ, cảng đi và cảng về sẽ được nhập riêng; nội dung lịch trình nguồn không bị sửa.</p>
    {can('CRUISE_CREATE')&&<ButtonLink to={'/admin/cruises/new?sourceVersionId='+encodeURIComponent(version.versionId)}>Tạo lần khởi hành từ phiên bản này</ButtonLink>}
    <Link to="/admin/cruises">Mở danh sách lần khởi hành</Link>
  </details>
}
