import { useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Empty, Field, PageHeader } from '@/shared/ui'
import { activityApi } from '../api/activity-api'
import { activityStatusLabels, activityTime } from '../model/activity'
import { ActivityFrame, ActivityState } from './ActivityUI'
import styles from './AssignedActivities.module.css'

export function AssignedActivityWorkspace() {
  const access = useSessionAccess()
  const query = useReadQuery(`assigned-activities:${access.userId}`, activityApi.list)
  const cruises = useReadQuery(`assigned-activity-cruises:${access.userId}`, activityApi.cruises)
  const [search, setSearch] = useState('')
  const term = search.trim().toLocaleLowerCase('vi')
  const rows = [...(query.data ?? [])].filter(item => !term || [item.name, item.location, item.code].some(text => text?.toLocaleLowerCase('vi').includes(term)))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
  return <ActivityFrame>
    <PageHeader title="Hoạt động được phân công" breadcrumb="Trên tàu" description="Kiểm tra thời gian, điểm tập trung và điểm danh khách đã đăng ký." actions={<Button tone="secondary" onClick={() => { query.retry(); cruises.retry() }}>Tải lại lịch</Button>} />
    <section className={styles.workspace} aria-label="Lịch hoạt động được giao">
      <div className={styles.filters}><Field htmlFor="assigned-activity-search" label="Tìm hoạt động hoặc địa điểm"><input id="assigned-activity-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field></div>
      <ActivityState {...query} />
      {!query.loading && !query.error && !rows.length && <Empty title={query.data?.length ? 'Không có hoạt động phù hợp' : 'Bạn chưa được phân công hoạt động'}>Lịch thực hiện sẽ xuất hiện khi bộ phận điều phối giao hoạt động cho bạn.</Empty>}
      {!query.loading && !query.error && rows.length > 0 && <ol className={styles.tasks}>
        {rows.map(item => <li key={item.id} data-progress={item.status === 'IN_PROGRESS' ? 'current' : undefined}>
          <div className={styles.time}><span>Bắt đầu · giờ Việt Nam</span><strong>{activityTime(item.startTime)}</strong><small>Đến {activityTime(item.endTime)}</small></div>
          <div className={styles.content}><div className={styles.taskHeading}><h2>{item.name}</h2><span>{activityStatusLabels[item.status] ?? 'Cần kiểm tra trạng thái'}</span></div>
            <p className={styles.context}>{cruises.data?.find(cruise => cruise.cruiseId === item.cruiseId)?.cruiseName ?? (cruises.loading ? 'Đang tải tên chuyến…' : 'Chưa đọc được tên chuyến')}</p>
            <dl><div><dt>Địa điểm</dt><dd>{item.location || 'Chưa ghi địa điểm'}</dd></div><div><dt>Boong / cabin</dt><dd>{[item.deckName || (item.deckNumber != null ? `Boong ${item.deckNumber}` : ''), item.cabinNumber ? `Cabin ${item.cabinNumber}` : ''].filter(Boolean).join(' · ') || 'Chưa ghi nhận'}</dd></div></dl>
          </div>
          <div className={styles.action}><ButtonLink autoWidth tone={item.status === 'IN_PROGRESS' ? 'primary' : 'secondary'} to={`/admin/activities/${item.id}`}>{item.status === 'IN_PROGRESS' ? 'Điểm danh hành khách' : 'Xem nhiệm vụ'}</ButtonLink></div>
        </li>)}
      </ol>}
    </section>
  </ActivityFrame>
}
