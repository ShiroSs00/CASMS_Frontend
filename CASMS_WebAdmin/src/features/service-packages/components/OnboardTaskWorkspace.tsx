import { useCallback, useMemo, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Empty, Field, PageHeader } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { catalogTime, formatUnitCode } from '../model/catalog'
import { CatalogFrame, CatalogState } from './CatalogUI'
import styles from './OnboardTasks.module.css'

const states: Record<string, string> = { REQUESTED: 'Chờ tiếp nhận', ACCEPTED: 'Chờ thực hiện', IN_PROGRESS: 'Đang phục vụ', COMPLETED: 'Đã phục vụ', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy' }
type Filter = 'active' | 'IN_PROGRESS' | 'COMPLETED' | 'all'
const filters: [Filter, string][] = [['active', 'Chưa hoàn thành'], ['IN_PROGRESS', 'Đang phục vụ'], ['COMPLETED', 'Đã phục vụ'], ['all', 'Tất cả việc được giao']]

export function OnboardTaskWorkspace() {
  const access = useSessionAccess()
  const query = useReadQuery(`onboard-service-tasks:${access.userId}`, useCallback(signal => servicePackageApi.requests(signal), []))
  const [filter, setFilter] = useState<Filter>('active'), [search, setSearch] = useState(''), [cruise, setCruise] = useState('')
  const tasks = useMemo(() => [...(query.data ?? [])].sort((a, b) => {
    const priority = (status: string) => status === 'IN_PROGRESS' ? 0 : ['REQUESTED', 'ACCEPTED'].includes(status) ? 1 : 2
    return priority(a.status) - priority(b.status) || Date.parse(a.scheduledStart ?? a.requestTime) - Date.parse(b.scheduledStart ?? b.requestTime)
  }), [query.data])
  const cruiseNames = [...new Set(tasks.map(task => task.cruiseName).filter((name): name is string => Boolean(name)))]
  const term = search.trim().toLocaleLowerCase('vi')
  const visible = tasks.filter(task => (!cruise || task.cruiseName === cruise)
    && (filter === 'all' || filter === 'active' ? filter === 'all' || ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(task.status) : task.status === filter)
    && (!term || [task.serviceName, task.passengerName, task.location, task.bookingReference, task.note].some(value => value?.toLocaleLowerCase('vi').includes(term))))
  return <CatalogFrame>
    <PageHeader title="Công việc phục vụ" breadcrumb="Trên tàu" description="Yêu cầu dịch vụ được phân công cho bạn." actions={<Button tone="secondary" disabled={query.loading} onClick={query.retry}>Tải lại công việc</Button>} />
    <section className={styles.workspace} aria-label="Yêu cầu dịch vụ được giao">
      <div className={styles.filters}>
        <Field htmlFor="onboard-task-search" label="Tìm công việc hoặc khách"><input id="onboard-task-search" type="search" value={search} placeholder="Dịch vụ, tên khách, địa điểm…" onChange={event => setSearch(event.target.value)} /></Field>
        <Field htmlFor="onboard-task-cruise" label="Chuyến được phân công"><select id="onboard-task-cruise" value={cruise} onChange={event => setCruise(event.target.value)}><option value="">Tất cả chuyến được giao</option>{cruiseNames.map(name => <option key={name} value={name}>{name}</option>)}</select></Field>
      </div>
      <div className={styles.views} role="group" aria-label="Tiến độ công việc">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{query.data && !query.error && !query.loading && <span>{tasks.filter(task => value === 'all' || value === 'active' ? value === 'all' || ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(task.status) : task.status === value).length}</span>}</button>)}</div>
      <CatalogState {...query} />
      {!query.loading && !query.error && query.data && !visible.length && <Empty title={tasks.length ? 'Không có công việc phù hợp' : 'Bạn chưa được giao yêu cầu dịch vụ'}>{tasks.length ? <Button tone="secondary" onClick={() => { setSearch(''); setCruise(''); setFilter('all') }}>Xem tất cả việc được giao</Button> : 'Công việc sẽ xuất hiện khi bộ phận điều phối phân công cho bạn.'}</Empty>}
      {!query.loading && !query.error && visible.length > 0 && <ol className={styles.tasks} aria-label="Danh sách công việc">
        {visible.map(task => <li key={task.id} data-progress={task.status === 'IN_PROGRESS' ? 'current' : undefined}>
          <div className={styles.time}><span>{task.scheduledStart ? 'Giờ phục vụ' : 'Yêu cầu lúc'}</span><strong>{catalogTime(task.scheduledStart ?? task.requestTime)}</strong>{task.scheduledEnd && <small>Đến {catalogTime(task.scheduledEnd)}</small>}</div>
          <div className={styles.content}>
            <div className={styles.taskHeading}><h2>{task.serviceName || 'Yêu cầu dịch vụ được giao'}</h2><span>{states[task.status] ?? 'Cần kiểm tra trạng thái'}</span></div>
            <p className={styles.context}>{task.cruiseName || 'Chưa có tên chuyến'}{task.shipName && ` · ${task.shipName}`}</p>
            <dl><div><dt>Phục vụ khách</dt><dd>{task.passengerName || 'Chưa có tên khách'}</dd></div><div><dt>Địa điểm</dt><dd>{task.location || 'Chưa ghi địa điểm phục vụ'}</dd></div><div><dt>Số lượng</dt><dd>{task.quantity} {formatUnitCode(task.unitCode) || ''}</dd></div></dl>
            {task.note && <p className={styles.note}><strong>Khách lưu ý: </strong>{task.note}</p>}
          </div>
          <div className={styles.action}><ButtonLink tone={['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(task.status) ? 'primary' : 'secondary'} autoWidth to={`/admin/service-requests/${task.id}`}>{task.status === 'REQUESTED' ? 'Tiếp nhận yêu cầu' : task.status === 'ACCEPTED' ? 'Bắt đầu phục vụ' : task.status === 'IN_PROGRESS' ? 'Ghi nhận kết quả' : 'Xem kết quả'}</ButtonLink></div>
        </li>)}
      </ol>}
    </section>
  </CatalogFrame>
}
