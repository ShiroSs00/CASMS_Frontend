import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

import { Badge } from '@/shared/ui'

import type { ItineraryStatus } from '../model/itinerary'
import { itineraryStatusLabels } from '../model/itinerary'
import styles from './Itineraries.module.css'

const navigation = [
  ['Tổng quan', ''], ['Bookings', ''], ['Check-in', ''], ['Yêu cầu dịch vụ', ''],
  ['Tài khoản', ''], ['Tàu', '/admin/ships'], ['Chuyến', '/admin/cruises'],
  ['Hải trình', '/admin/itineraries'], ['Cảng', '/admin/ports'], ['Điểm đến', '/admin/destinations'],
  ['Quy định', '/admin/regulations'], ['Sự cố', '/admin/issues'], ['Người dùng', ''], ['Báo cáo', ''],
] as const

export function ItineraryFrame({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} to="/admin/itineraries"><strong>AURORA</strong></Link>
      <span className={styles.brandCaption}>Trung tâm vận hành</span><nav aria-label="Điều hướng quản trị">{navigation.map(([label, href]) => href ? <NavLink className={({ isActive }) => isActive ? styles.navActive : styles.nav} key={label} to={href}>{label}</NavLink> : <span key={label} className={styles.nav} aria-disabled="true">{label}</span>)}</nav>
    </aside>
    <main className={styles.main}><header className={styles.topbar}><span>Tìm kiếm hoặc chạy lệnh…</span><b>Đã đăng nhập</b></header><div className={styles.canvas}>{children}</div></main>
  </div>
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
