import { useId, useState } from 'react'
import { useSearchParams } from 'react-router'
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
  const [params, setParams] = useSearchParams()
  const requestedId = params.get('cruiseId')
  const id = useId()
  const pending = query.data ?? []
  const savedSelection = selected?.cruiseId === requestedId ? selected : null
  const current = requestedId ? pending.find(item => item.cruiseId === requestedId) ?? savedSelection : pending[0]
  const options = savedSelection && !pending.some(item => item.cruiseId === savedSelection.cruiseId)
    ? [...pending, savedSelection] : pending
  function openTour(cruiseId: string | null) {
    const next = new URLSearchParams(params)
    if (cruiseId) next.set('cruiseId', cruiseId)
    else next.delete('cruiseId')
    setParams(next)
  }
  return <CruiseFrame><div className={styles.workspace}>
    <PageHeader breadcrumb="Quản lý tàu" title="Đề nghị bố trí dịch vụ"
      actions={<Button tone="secondary" size="compact" onClick={query.retry}>Cập nhật</Button>} />
    <Panel title="Tour chờ phản hồi">
      {query.loading && <Loading label="Đang tải các tour chờ phản hồi…" />}
      {query.error && <Notice tone="error" title="Chưa tải được danh sách">
        <Button tone="secondary" onClick={query.retry}>Thử lại</Button>
      </Notice>}
      {query.data && requestedId && !current && (
        <Empty title="Tour này không có đề nghị đang chờ phản hồi">
          <Button tone="secondary" onClick={() => openTour(null)}>Xem danh sách tour</Button>
        </Empty>
      )}
      {query.data && !requestedId && !pending.length && <Empty title="Không có tour đang chờ phản hồi" />}
      {current && <Field htmlFor={id} label="Tour cần xem">
        <select id={id} value={current.cruiseId} onChange={event => openTour(event.target.value)}>
          {options.map(item => <option value={item.cruiseId} key={item.cruiseId}>
            {item.name} · {item.code}{pending.includes(item) ? ` · ${item.pending} đề nghị` : ' · Đã phản hồi'}
          </option>)}
        </select>
      </Field>}
    </Panel>
    {current && <ServiceLocationRequests key={current.cruiseId} cruiseId={current.cruiseId}
      onChanged={() => { if (!requestedId) openTour(current.cruiseId); setSelected(current); query.retry() }} />}
  </div></CruiseFrame>
}
