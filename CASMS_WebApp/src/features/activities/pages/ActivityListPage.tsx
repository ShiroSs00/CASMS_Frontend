import { PermissionLink as Link } from '@/shared/ui'
import { useState } from 'react'

import { useReadQuery } from '@/shared/api'
import { Button, ButtonLink, DataTable, Empty, PageHeader, Panel } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { activityApi } from '../api/activity-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { activityTime, activityStatusLabels } from '../model/activity'
import styles from '../components/Activities.module.css'
export function ActivityListPage() {
  const access = useSessionAccess()
  const query = useReadQuery('activities', activityApi.list)
  const [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const items = query.data?.filter(item => (!status || item.status === status) && `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  return <ActivityFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title="Hoạt động trên tàu" description="Lịch hoạt động, sức chứa, đăng ký và tham gia theo từng chuyến." actions={<><ButtonLink tone="secondary" to="/admin/activity-registrations">Đăng ký & điểm danh</ButtonLink>{access.has('ACTIVITY_CREATE') && <ButtonLink to="/admin/activities/new">Tạo hoạt động</ButtonLink>}</>} />
    <Panel title="Tìm kiếm & bộ lọc"><div className={styles.filters}><label>Tên hoặc mã hoạt động<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{Object.entries(activityStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button tone="secondary" onClick={() => { setSearch(''); setStatus('') }}>Xóa bộ lọc</Button></div></Panel>
    <Panel title="Danh sách hoạt động"><ActivityState {...query} />{query.data && !items.length && <Empty title={query.data.length ? 'Không có hoạt động khớp bộ lọc' : 'Chưa có hoạt động trên tàu'} />}{query.data && items.length > 0 && <DataTable label="Danh sách hoạt động" headers={['Hoạt động', 'Thời gian', 'Địa điểm', 'Sức chứa', 'Trạng thái', '']}>
      {items.map(item => <tr key={item.id}><td>{item.name}<br />{item.code}</td><td>{activityTime(item.startTime)} → {activityTime(item.endTime)}</td><td>{item.location || 'Chưa xác định'}</td><td>{item.capacity}</td><td>{activityStatusLabels[item.status] ?? item.status}</td><td><Link to={`/admin/activities/${item.id}`}>Xem chi tiết</Link></td></tr>)}
    </DataTable>}</Panel></ActivityFrame>
}
