import { useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
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
  const totalPending = pending.reduce((sum, item) => sum + (item.pending ?? 0), 0)

  function openTour(cruiseId: string | null) {
    const next = new URLSearchParams(params)
    if (cruiseId) next.set('cruiseId', cruiseId)
    else next.delete('cruiseId')
    setParams(next)
  }

  return (
    <CruiseFrame>
      <div className={styles.workspace}>
        <div className={styles.stack}>
          <PageHeader
            breadcrumb="Quản lý tàu / Xét duyệt chuyến"
            title="Đề nghị bố trí dịch vụ trên boong"
            description="Xác nhận vị trí boong cho từng dịch vụ do Quản lý dịch vụ đề xuất, hoặc yêu cầu bổ sung nếu boong chưa đáp ứng sức chứa / chưa gắn dịch vụ."
            actions={
              <Button tone="secondary" size="compact" autoWidth onClick={query.retry}>
                Cập nhật
              </Button>
            }
          />
          <nav className={styles.shipSwitcher} aria-label="Các đầu việc duyệt của Quản lý tàu">
            <Link to="/admin/preparation-requests" className={styles.shipSwitchTab}>
              1. Xác nhận đáp ứng tàu
            </Link>
            <Link to="/admin/service-locations" aria-current="page" className={`${styles.shipSwitchTab} ${styles.shipSwitchTabActive}`}>
              2. Đề nghị bố trí dịch vụ ({totalPending})
            </Link>
            <Link to="/admin/staffing-reviews" className={styles.shipSwitchTab}>
              3. Xét phương án nhân sự
            </Link>
          </nav>
          <Panel
            title="Chuyến đang chờ duyệt bố trí"
            subtitle={
              pending.length > 0
                ? `${pending.length} chuyến · Tổng ${totalPending} đề nghị chờ bạn xác nhận`
                : 'Chọn chuyến để xem và phản hồi đề nghị bố trí dịch vụ'
            }
          >
            {query.loading && <Loading label="Đang tải các chuyến chờ phản hồi…" />}
            {query.error && (
              <Notice tone="error" title="Chưa tải được danh sách chuyến">
                <Button tone="secondary" size="compact" autoWidth onClick={query.retry}>Thử lại</Button>
              </Notice>
            )}
            {query.data && requestedId && !current && (
              <Empty title="Chuyến này hiện không có đề nghị nào chờ phản hồi">
                <Button tone="secondary" size="compact" autoWidth onClick={() => openTour(null)}>
                  Xem tất cả chuyến đang chờ
                </Button>
              </Empty>
            )}
            {query.data && !requestedId && !pending.length && (
              <Empty title="Không còn đề nghị bố trí dịch vụ nào đang chờ duyệt">
                <p>Khi Quản lý dịch vụ gửi đề nghị bố trí mới cho tàu bạn phụ trách, danh sách sẽ hiển thị tại đây.</p>
                <ButtonLink to="/admin/preparation-requests" tone="secondary" size="compact" autoWidth>
                  ← Quay lại Trung tâm duyệt chuyến
                </ButtonLink>
              </Empty>
            )}
            {current && options.length <= 6 && (
              <div className={styles.tourChipBar} role="group" aria-label="Chọn chuyến cần xem">
                {options.map(item => {
                  const isCurrent = item.cruiseId === current.cruiseId
                  const hasPending = pending.includes(item)
                  return (
                    <button
                      key={item.cruiseId}
                      type="button"
                      className={styles.tourChip}
                      aria-pressed={isCurrent}
                      onClick={() => openTour(item.cruiseId)}
                    >
                      <span>
                        <strong>{item.code}</strong> · {item.name}
                      </span>
                      <span className={styles.tourChipCount}>
                        {hasPending ? `${item.pending} chờ duyệt` : 'Đã phản hồi'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {current && options.length > 6 && (
              <Field htmlFor={id} label="Chọn chuyến cần xem">
                <select id={id} value={current.cruiseId} onChange={event => openTour(event.target.value)}>
                  {options.map(item => (
                    <option value={item.cruiseId} key={item.cruiseId}>
                      {item.code} · {item.name}{pending.includes(item) ? ` (${item.pending} đề nghị chờ)` : ' (Đã phản hồi)'}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Panel>
          {current && (
            <ServiceLocationRequests
              key={current.cruiseId}
              cruiseId={current.cruiseId}
              onChanged={() => {
                if (!requestedId) openTour(current.cruiseId)
                setSelected(current)
                query.retry()
              }}
            />
          )}
        </div>
      </div>
    </CruiseFrame>
  )
}
