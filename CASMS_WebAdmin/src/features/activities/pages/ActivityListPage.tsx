import { useState } from 'react'

import { useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, CollectionSummary, DataTable, Empty, Field, ListFilters, Modal, PageHeader, Panel } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { activityApi } from '../api/activity-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { activityTime, activityStatusLabels } from '../model/activity'
import styles from '../components/Activities.module.css'
import { ActivityDetailPage } from './ActivityDetailPage'
export function ActivityListPage() {
  const access = useSessionAccess()
  const query = useReadQuery('activities', activityApi.list)
  const [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const catalog = useReadQuery(`activity-catalog:${access.userId}`, activityApi.catalog)
  const [selected, setSelected] = useState<{id:string;name:string}|null>(null)
  const [view, setView] = useState<'catalog' | 'schedule'>('catalog')
  const catalogItems = catalog.data?.filter(item => `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  const items = query.data?.filter(item => (!status || item.status === status) && `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  return <ActivityFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title="Hoạt động trên tàu"  actions={<><ButtonLink tone="secondary" to="/admin/activity-registrations">Đăng ký & điểm danh</ButtonLink>{access.canDo('ACTIVITY_CREATE') && <ButtonLink to="/admin/activities/new">Tạo hoạt động dùng chung</ButtonLink>}</>} />
    <div className={styles.actions}>
      <Button tone={view === 'catalog' ? 'primary' : 'secondary'} aria-pressed={view === 'catalog'} onClick={() => setView('catalog')}>Danh mục dùng chung</Button>
      <Button tone={view === 'schedule' ? 'primary' : 'secondary'} aria-pressed={view === 'schedule'} onClick={() => setView('schedule')}>Hoạt động theo chuyến</Button>
    </div>
    {view === 'catalog' ? <Panel title="Danh mục hoạt động">
      <ListFilters label="Tìm trong danh mục hoạt động" actions={<Button tone="secondary" disabled={!search} onClick={() => setSearch('')}>Xóa bộ lọc</Button>}>
        <Field htmlFor="activity-catalog-search" label="Tên hoặc mã hoạt động"><input type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      </ListFilters>
      <ActivityState {...catalog} />
      {catalog.data && !catalogItems.length && <Empty title={search ? 'Không có hoạt động khớp tìm kiếm' : 'Chưa có hoạt động trong danh mục'} />}
      {catalogItems.length > 0 && <DataTable label="Danh mục hoạt động" headers={['Hoạt động', 'Sức chứa', 'Giá tham chiếu', '']}>
        {catalogItems.map(item => <tr key={item.id}><td><span className={styles.recordName}>{item.name}</span><span className={styles.recordCode}>{item.code}</span></td><td>{item.capacity ?? 'Chưa cấu hình'}</td><td>{item.price == null ? 'Chưa cấu hình' : `${item.price} ${item.currencyCode ?? ''}`}</td><td><Button tone="secondary" size="compact" autoWidth onClick={() => setSelected({id:item.id,name:item.name})}>Xem chi tiết</Button></td></tr>)}
      </DataTable>}
    </Panel> : <>
    <CollectionSummary count={query.loading || query.error ? null : query.data?.length ?? null} visible={items.length} filtered={Boolean(search || status)} label="Hoạt động đã tải" />
    <Panel title="Tìm kiếm & bộ lọc"><ListFilters label="Bộ lọc hoạt động theo chuyến" actions={<Button tone="secondary" disabled={!search && !status} onClick={() => { setSearch(''); setStatus('') }}>Xóa bộ lọc</Button>}>
      <Field htmlFor="activity-search" label="Tên hoặc mã hoạt động"><input type="search" placeholder="Tìm hoạt động trên tàu…" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <Field htmlFor="activity-status" label="Trạng thái"><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{Object.entries(activityStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    </ListFilters></Panel>
    <Panel title="Danh sách hoạt động"><ActivityState {...query} />{query.data && !items.length && <Empty title={query.data.length ? 'Không có hoạt động khớp bộ lọc' : 'Chưa có hoạt động trên tàu'} />}{query.data && items.length > 0 && <DataTable label="Danh sách hoạt động" headers={['Hoạt động', 'Thời gian', 'Địa điểm', 'Sức chứa', 'Trạng thái', '']}>
      {items.map(item => <tr key={item.id}><td><span className={styles.recordName}>{item.name}</span><span className={styles.recordCode}>{item.code}</span></td><td>{activityTime(item.startTime)}<span className={styles.recordCode}>đến {activityTime(item.endTime)}</span></td><td>{item.location || 'Chưa xác định'}</td><td>{item.capacity}</td><td><Badge label={activityStatusLabels[item.status] ?? item.status} tone={item.status === 'CANCELLED' ? 'error' : item.status === 'COMPLETED' ? 'success' : item.status === 'IN_PROGRESS' ? 'info' : 'neutral'} /></td><td><Button tone="secondary" size="compact" autoWidth onClick={() => setSelected({id:item.id,name:item.name})}>Xem chi tiết</Button></td></tr>)}
    </DataTable>}</Panel></>}{selected && <Modal title={selected.name} large protectChanges={false} onClose={() => setSelected(null)} footer={<Button tone="secondary" onClick={() => setSelected(null)}>Đóng</Button>}><div><ActivityDetailPage recordId={selected.id} embedded /></div></Modal>}</ActivityFrame>
}
