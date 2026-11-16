import { useId, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { CruiseFrame } from '../components/CruiseUI'
import { ServiceLocationRequests } from '../components/ServiceLocationRequests'
import styles from '../staffing/Staffing.module.css'

type InboxItem = { cruiseId: string; name: string; code: string; pending: number }
const loadInbox = (signal: AbortSignal) => apiRequest<InboxItem[]>('/cruise/service-locations/inbox', { signal })

export function ServiceLocationInboxPage() {
  const access = useSessionAccess()
  const query = useReadQuery(`service-location-inbox:${access.userId}`, loadInbox)
  const [selected, setSelected] = useState<InboxItem | null>(null)
  const id = useId()
  const pending = query.data ?? []
  const current = selected ?? pending[0]
  const options = selected && !pending.some(item => item.cruiseId === selected.cruiseId)
    ? [...pending, selected] : pending
  return <CruiseFrame><div className={styles.workspace}>
    <PageHeader breadcrumb="Quản lý tàu" title="Đề nghị bố trí dịch vụ" />
    <Panel title="Tour chờ phản hồi">
      {query.loading && <Loading label="Đang tải các tour chờ phản hồi…" />}
      {query.error && <Notice tone="error" title="Chưa tải được danh sách">
        <Button tone="secondary" onClick={query.retry}>Thử lại</Button>
      </Notice>}
      {query.data && !pending.length && <Empty title="Không có tour đang chờ phản hồi" />}
      {current && <Field htmlFor={id} label="Tour cần xem">
        <select id={id} value={current.cruiseId} onChange={event =>
          setSelected(options.find(item => item.cruiseId === event.target.value) ?? null)}>
          {options.map(item => <option value={item.cruiseId} key={item.cruiseId}>
            {item.name} · {item.code}{pending.includes(item) ? ` · ${item.pending} đề nghị` : ' · Đã phản hồi'}
          </option>)}
        </select>
      </Field>}
    </Panel>
    {current && <ServiceLocationRequests key={current.cruiseId} cruiseId={current.cruiseId}
      onChanged={() => { setSelected(current); query.retry() }} />}
  </div></CruiseFrame>
}
