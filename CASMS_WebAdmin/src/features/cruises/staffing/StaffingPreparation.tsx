import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, Loading, Notice } from '@/shared/ui'
import { positionLabels, staffingApi, staffingError, staffingStatusLabel, type Preparation } from './staffing-api'
import { StaffingV2 } from './StaffingV2'
import styles from './Staffing.module.css'
import workspaceStyles from '../components/ManagerWorkspace.module.css'

const v2WaitingCopy: Record<string, string> = {
  PENDING_ASM: 'Quản lý dịch vụ đang phụ trách chuẩn bị chương trình và xác định số nhân viên cần cho từng dịch vụ, hoạt động.',
  PENDING_SHIP_REVIEW: 'Đang chờ Quản lý tàu mở khu vực, gắn máy POS và bố trí dịch vụ (xong sẽ chuyển thẳng sang HR phân công).',
  SENT_TO_HR: 'Đang chờ Quản lý nhân sự phân công đủ nhân viên cho từng dịch vụ, khu vực và ca hoạt động.',
  HR_SUBMITTED: 'Quản lý nhân sự đã gửi phương án. Đang chờ Quản lý tàu xác nhận sau phân công trước khi bạn rà soát.',
  PLANNER_CONFIRMED: 'Đã gửi Quản lý vận hành xem xét và phê duyệt phương án nhân sự.',
}

export function StaffingPreparation({ cruiseId, refreshKey, onStarted, onBudgetRequired, providedQuery }: {
  cruiseId: string; refreshKey: string; onStarted: () => void; onBudgetRequired: () => void
  providedQuery?: { data: Preparation | null; loading: boolean; error: Error | null; retry: () => void }
}) {
  const provided = Boolean(providedQuery)
  const fallback = useReadQuery(
    'staffing-preparation:' + cruiseId + ':' + refreshKey,
    useCallback(signal => provided ? Promise.resolve(null) : staffingApi.preparation(cruiseId, signal), [cruiseId, provided]),
  )
  const query = providedQuery ?? fallback
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const data = query.data
  if (query.error instanceof ApiError && query.error.status === 403) return null
  if (query.loading && !data) return <Loading label="Đang tải phương án nhân sự…" />
  if (query.error || !data) {
    return (
      <Notice tone="error" title="Chưa tải được phương án nhân sự">
        <p>{staffingError(query.error)}</p>
        <Button tone="secondary" size="compact" autoWidth onClick={query.retry}>Thử lại</Button>
      </Notice>
    )
  }
  const current = data.request
  const active = current && !['RETURNED', 'CANCELLED'].includes(current.status)
  const v2 = current?.workflowVersion === 'V2'
  const actionable = current?.status === 'SHIP_REVIEWED' || current?.status === 'SHIP_CONFIRMED'
    || current?.status === 'OPS_APPROVED' || (current?.shipPlanStale && current.status === 'PLANNER_CONFIRMED')

  async function start() {
    if (lock.current || !data?.hasOperatingBudget) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await staffingApi.send(cruiseId)
      onStarted()
      query.retry()
    } catch (cause) {
      setError(staffingError(cause))
      if (cause instanceof ApiError && cause.code === 'PREPARATION_BUDGET_REQUIRED') {
        onBudgetRequired()
        query.retry()
      } else if (cause instanceof ApiError && cause.status === 409) {
        query.retry()
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <section className={workspaceStyles.deptUnitBox} aria-label="Điều phối chuẩn bị chuyến">
      <header className={workspaceStyles.deptUnitHeader}>
        <div>
          <div className={workspaceStyles.deptUnitTitle}>
            <h4>Chương trình, tàu và nhân sự</h4>
        {!providedQuery && <Badge
          label={current ? staffingStatusLabel(current) : data.requiresReplanning ? 'Cần lập lại phương án' : 'Chưa bắt đầu'}
          tone={
            current?.status === 'OPS_APPROVED'
              ? 'success'
              : actionable
                ? 'warning'
                : 'neutral'
          }
        />}
          </div>
          {!active && <p className={workspaceStyles.sectionMeta}>Giao công việc chuẩn bị cho Dịch vụ, Tàu và Nhân sự.</p>}
          {active && v2 && v2WaitingCopy[current.status] && (
            <p className={workspaceStyles.sectionMeta}>{v2WaitingCopy[current.status]}</p>
          )}
        </div>
      </header>
      {current?.returnReason && <Notice title="Yêu cầu cần bổ sung" tone="warning">{current.returnReason}</Notice>}
      {active && v2 && actionable && (
        <StaffingV2
          key={current.status}
          request={current}
          coordinator
          onChanged={() => {}}
          onCompleted={query.retry}
        />
      )}
      {active && v2 && !actionable && (
        <div className={styles.section}>
          {(current.serviceNeeds?.length || current.needs?.length) ? (
            <ul className={styles.rows}>
              {(current.serviceNeeds ?? []).map(item => {
                const gap = Math.max(0, item.requiredCount - item.assignedUserIds.length)
                return (
                  <li className={styles.row} key={`svc:${item.serviceId}`}>
                    <div className={styles.rowMain}>
                      <strong>{item.serviceName} · {item.areaName}</strong>
                      <span className={styles.subtle}>{item.assignedUserIds.length}/{item.requiredCount} nhân viên phục vụ</span>
                    </div>
                    <Badge
                      label={gap === 0 ? 'Đủ người' : `Thiếu ${gap} người`}
                      tone={gap === 0 ? 'success' : 'warning'}
                    />
                  </li>
                )
              })}
              {(current.needs ?? []).map(need => {
                const gap = Math.max(0, need.requiredCount - need.assignedUserIds.length)
                return (
                  <li className={styles.row} key={need.needId}>
                    <div className={styles.rowMain}>
                      <strong>{need.areaName} · {positionLabels[need.positionCode] ?? need.positionCode}</strong>
                      <span className={styles.subtle}>{need.assignedUserIds.length}/{need.requiredCount} đã phân công</span>
                    </div>
                    <Badge
                      label={gap === 0 ? 'Đủ người' : `Thiếu ${gap} người`}
                      tone={gap === 0 ? 'success' : 'warning'}
                    />
                  </li>
                )
              })}
            </ul>
          ) : null}
          {!current.serviceNeeds?.length && !current.needs?.length && <p className={workspaceStyles.sectionMeta}>
            Chưa có danh sách vị trí hoặc nhân viên được phân công trong phương án hiện tại.
          </p>}
        </div>
      )}
      {active && !v2 && <>
        <ul className={styles.rows}>
          {current.requirements.map(row => <li className={styles.row} key={row.serviceId}>
            <strong>{row.serviceName}</strong><span>{row.assigned}/{row.required} đã bố trí</span>
          </li>)}
        </ul>
        {current.status === 'SHIP_CONFIRMED' && !current.shipReviewWorkflow && <Button busy={busy} autoWidth
          onClick={async () => {
            if (lock.current) return
            lock.current = true
            setBusy(true)
            setError('')
            try {
              await staffingApi.transition(current, 'PLANNER_CONFIRMED')
              query.retry()
            } catch (cause) {
              setError(staffingError(cause))
            } finally {
              setBusy(false)
              lock.current = false
            }
          }}>Gửi phương án cho Quản lý vận hành</Button>}
      </>}
      {!active && <div className={workspaceStyles.coordinationStart}>
        {data.requiresReplanning && <Notice title="Phương án trước không còn hiệu lực" tone="warning">
          Khởi tạo lại phương án tàu và nhân sự theo chương trình hiện tại.
        </Notice>}
        <Button busy={busy} disabled={!data.hasOperatingBudget} autoWidth onClick={() => void start()}>
            {data.requiresReplanning ? 'Lập lại phương án tàu và nhân sự' : 'Bắt đầu chuẩn bị chuyến'}
        </Button>
        {!data.hasOperatingBudget && <p className={workspaceStyles.sectionMeta}>Lưu ngân sách dự kiến trước khi giao việc.</p>}
      </div>}
      {error && <Notice tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
      {current && <Button tone="text" size="compact" autoWidth disabled={busy} onClick={query.retry}>
        Cập nhật tiến độ
      </Button>}
    </section>
  )
}
