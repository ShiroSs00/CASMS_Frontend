import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, Loading, Notice } from '@/shared/ui'
import { positionLabels, staffingApi, staffingError, staffingStatusLabel } from './staffing-api'
import { StaffingV2 } from './StaffingV2'
import styles from './Staffing.module.css'
import workspaceStyles from '../components/ManagerWorkspace.module.css'

const v2WaitingCopy: Record<string, string> = {
  PENDING_ASM: 'Đang chờ Quản lý dịch vụ nhận việc và hoàn tất chương trình phục vụ của chuyến.',
  PENDING_SHIP_REVIEW: 'Đang chờ Quản lý tàu kiểm tra tàu và cabin, chọn khu vực mở, gắn máy POS, bố trí dịch vụ và nhập định biên nhân sự.',
  SENT_TO_HR: 'Đang chờ Quản lý nhân sự phân công nhân viên đủ điều kiện vào từng khu vực, vị trí và ca hoạt động.',
  PLANNER_CONFIRMED: 'Đã gửi Quản lý vận hành xem xét và phê duyệt phương án nhân sự.',
}

export function StaffingPreparation({ cruiseId, refreshKey, onStarted, onBudgetRequired }: {
  cruiseId: string; refreshKey: string; onStarted: () => void; onBudgetRequired: () => void
}) {
  const query = useReadQuery(
    'staffing-preparation:' + cruiseId + ':' + refreshKey,
    useCallback(signal => staffingApi.preparation(cruiseId, signal), [cruiseId]),
  )
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
  const active = current && current.status !== 'RETURNED'
  const v2 = current?.workflowVersion === 'V2'
  const actionable = current?.status === 'SHIP_REVIEWED' || current?.status === 'HR_SUBMITTED'
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
    <section className={workspaceStyles.deptUnitBox} aria-label="Nhân sự của tour">
      <header className={workspaceStyles.deptUnitHeader}>
        <div>
          <h4>Chuẩn bị nhân sự</h4>
          {active && v2 && v2WaitingCopy[current.status] && (
            <p className={workspaceStyles.sectionMeta}>{v2WaitingCopy[current.status]}</p>
          )}
        </div>
        <Badge
          label={current ? staffingStatusLabel(current) : 'Chưa khởi tạo'}
          tone={
            current?.status === 'OPS_APPROVED'
              ? 'success'
              : actionable
                ? 'warning'
                : 'neutral'
          }
        />
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
          {current.needs?.length ? (
            <ul className={styles.rows}>
              {current.needs.map(need => {
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
          <details className={styles.details}>
            <summary>Xem chi tiết phương án tàu và tiến độ nhân sự</summary>
            <div className={styles.detailsBody}>
              <StaffingV2
                request={current}
                coordinator
                readOnly
                onChanged={() => {}}
                onCompleted={query.retry}
              />
            </div>
          </details>
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
      {!active && <div className={styles.form}>
        <p className={workspaceStyles.sectionMeta}>Khởi tạo để Quản lý dịch vụ hoàn thiện chương trình và Quản lý tàu xác định khu vực mở cùng số người cần.</p>
        {!data.hasOperatingBudget && <Notice tone="warning" title="Cần lưu ngân sách vận hành dự kiến">
          <a href="#operating-budget">Đến mục ngân sách vận hành</a>
        </Notice>}
        <Button busy={busy} disabled={!data.hasOperatingBudget} autoWidth onClick={() => void start()}>
          Khởi tạo yêu cầu nhân sự
        </Button>
      </div>}
      {error && <Notice tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
      {current && <Button tone="text" size="compact" autoWidth disabled={busy} onClick={query.retry}>
        Cập nhật tiến độ
      </Button>}
    </section>
  )
}
