import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, Field, Loading, Notice, Panel } from '@/shared/ui'
import { cruiseStaffApi } from '../api/cruise-staff-api'
import {
  positionLabels, staffingApi, staffingCabinStatusLabels, staffingError, staffingMissing, staffingShipStatusLabels,
  type NeedInput, type ReviewDetails, type StaffingAction, type StaffingRequest,
} from './staffing-api'
import styles from './Staffing.module.css'

const actions = {
  PENDING_SHIP_REVIEW: { approve: 'SHIP_CHECKED', label: 'Xác nhận phương án tàu', back: 'SHIP_RETURN_ASM', backLabel: 'Trả Quản lý dịch vụ bổ sung chương trình' },
  SHIP_REVIEWED: { approve: 'SEND_TO_HR', label: 'Gửi Quản lý nhân sự phân công', back: 'CRM_RETURN_SHIP', backLabel: 'Trả Quản lý tàu' },
  SENT_TO_HR: { approve: 'HR_SUBMITTED', label: 'Gửi phương án cho Quản lý lịch trình', back: 'HR_RETURN_SHIP', backLabel: 'Báo thiếu hoặc yêu cầu kiểm tra lại tàu' },
  HR_SUBMITTED: { approve: 'PLANNER_CONFIRMED', label: 'Gửi Quản lý vận hành duyệt', back: 'CRM_RETURN_HR', backLabel: 'Trả Quản lý nhân sự bổ sung' },
  PLANNER_CONFIRMED: { approve: 'OPS_APPROVED', label: 'Duyệt phương án nhân sự', back: 'OPS_RETURN_CRM', backLabel: 'Trả Quản lý lịch trình' },
} satisfies Record<string, { approve: StaffingAction; label: string; back: StaffingAction; backLabel: string }>

const v2Steps = [
  { id: 'asm', title: '1. Chương trình', owner: 'Quản lý dịch vụ', statuses: ['PENDING_ASM'] },
  { id: 'ship', title: '2. Khu vực, POS & nhu cầu', owner: 'Quản lý tàu', statuses: ['PENDING_SHIP_REVIEW'] },
  { id: 'dispatch', title: '3. Kiểm tra & gửi nhân sự', owner: 'Quản lý lịch trình', statuses: ['SHIP_REVIEWED'] },
  { id: 'hr', title: '4. Phân công nhân sự', owner: 'Quản lý nhân sự', statuses: ['SENT_TO_HR'] },
  { id: 'approval', title: '5. Kiểm tra & phê duyệt', owner: 'Quản lý lịch trình → Quản lý vận hành', statuses: ['HR_SUBMITTED', 'PLANNER_CONFIRMED', 'OPS_APPROVED'] },
] as const

function formatShipStatus(status: string) {
  return staffingShipStatusLabels[status] ?? status
}

function formatCabinStatus(status: string) {
  return staffingCabinStatusLabels[status] ?? status
}

function formatActivityKind(kind: string) {
  if (kind === 'SHORE') return 'Tour tham quan trên bờ'
  if (kind === 'ONBOARD') return 'Hoạt động trên tàu'
  return kind
}

export function StaffingV2({ request, onChanged, onCompleted, coordinator = false, readOnly = false, refreshKey = 0 }: {
  request: StaffingRequest; onChanged: () => void; onCompleted: () => void; coordinator?: boolean; readOnly?: boolean; refreshKey?: number
}) {
  const details = useReadQuery(`staffing-review:${request.id}:${request.revision}:${refreshKey}`,
    useCallback(signal => staffingApi.reviewDetails(request.id, signal), [request.id]))
  const [latest, setLatest] = useState<ReviewDetails>()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [reason, setReason] = useState('')
  const [returning, setReturning] = useState(false)
  const [draft, setDraft] = useState<{ areas: string[]; needs: (Omit<NeedInput, 'requiredCount'> & { count: string })[] }>()
  const state = latest && latest.request.revision > (details.data?.request.revision ?? 0) ? latest : details.data
  const ship = !readOnly && request.status === 'PENDING_SHIP_REVIEW'
  const hr = !readOnly && request.status === 'SENT_TO_HR'
  const options = useReadQuery('staffing-need-candidates:' + request.cruiseId,
    useCallback(signal => hr ? cruiseStaffApi.options(request.cruiseId, signal) : Promise.resolve(null), [request.cruiseId, hr]))

  async function mutate(change: () => Promise<ReviewDetails | StaffingRequest>, finish = false) {
    if (lock.current || stale) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await change()
      if ('request' in result) setLatest(result)
      else if (!finish && state) {
        setLatest({ ...state, request: result })
        details.retry()
        options.retry()
      }
      if (finish) onCompleted()
      else onChanged()
    } catch (cause) {
      setError(staffingError(cause))
      if (cause instanceof ApiError && cause.code === 'STAFFING_REVISION_CONFLICT') {
        setStale(true)
        details.retry()
      }
      if (cause instanceof ApiError && cause.code === 'HANDOFF_TOUR_LOCKED') {
        setReturning(false)
        details.retry()
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (!state) {
    if (details.loading) return <Loading label="Đang tải phương án…" />
    return <Notice title="Chưa tải được phương án" tone="error">
      {staffingError(details.error)} <Button tone="text" onClick={details.retry}>Thử lại</Button>
    </Notice>
  }
  const current = state.request
  const legacyShip = ship && current.workflowVersion !== 'V2'
  const editingPlacement = ship && (!legacyShip || current.asmProgramWorkflow)
  const action = readOnly
    ? undefined
    : legacyShip
      ? { approve: 'SHIP_CHECKED' as const, label: 'Xác nhận phương án tàu', back: undefined, backLabel: '' }
      : coordinator && (current.shipPlanStale || current.status === 'OPS_APPROVED')
        ? { approve: undefined, label: '', back: 'CRM_RETURN_SHIP' as const, backLabel: 'Trả Quản lý tàu kiểm tra lại' }
        : actions[current.status as keyof typeof actions]
  const selected = current.activeAreaIds ?? []
  const needs = current.needs ?? []
  const activeAreas = state.areas.filter(area => legacyShip || selected.includes(area.areaId))
  const working = draft ?? {
    areas: selected,
    needs: needs.map(need => ({ areaId: need.areaId, positionCode: need.positionCode, count: String(need.requiredCount) })),
  }
  const invalid = working.areas.some(area => !working.needs.some(need => need.areaId === area))
    || working.needs.some(need => !/^\d+$/.test(need.count) || Number(need.count) < 1 || Number(need.count) > 2147483647)
  const disabled = busy || stale
  const name = (id: string) =>
    state.staff.find(staff => staff.userId === id)?.username
    ?? options.data?.users.find(user => user.userId === id)?.username
    ?? id

  const totalCabins = state.ship?.cabins.length ?? 0
  const availableCabins = state.ship?.cabins.filter(cabin => cabin.status === 'AVAILABLE').length ?? 0
  const posCoveredCount = activeAreas.filter(area => area.terminals.length > 0).length
  const servicesCoveredCount = state.plannedServices.filter(service => {
    const placed = service.placements[0]?.areaId
    return Boolean(placed && activeAreas.some(area => area.areaId === placed))
  }).length
  const totalRequired = needs.reduce((sum, need) => sum + need.requiredCount, 0)
  const totalAssigned = needs.reduce((sum, need) => sum + need.assignedUserIds.length, 0)
  const missingStaffCount = staffingMissing(current)
  const activitiesCoveredCount = state.activities.filter(activity => activity.staffIds.length > 0).length
  const missingActivitiesCount = Math.max(0, state.activities.length - activitiesCoveredCount)
  const draftHeadcount = working.needs.reduce((sum, item) => sum + (/^\d+$/.test(item.count) ? Number(item.count) : 0), 0)

  const currentStepIndex = v2Steps.findIndex(step => (step.statuses as readonly string[]).includes(current.status))

  return (
    <div className={styles.stack}>
      {current.workflowVersion === 'V2' && (
        <ol className={styles.workflowStepper} aria-label="Tiến độ quy trình nhân sự V2">
          {v2Steps.map((step, index) => {
            const isApproved = current.status === 'OPS_APPROVED'
            const isDone = isApproved || (currentStepIndex > -1 && index < currentStepIndex)
            const isCurrent = !isApproved && index === currentStepIndex
            const stepClass = isDone
              ? `${styles.workflowStep} ${styles.workflowStepDone}`
              : isCurrent
                ? `${styles.workflowStep} ${styles.workflowStepCurrent}`
                : styles.workflowStep
            return (
              <li key={step.id} className={stepClass} aria-current={isCurrent ? 'step' : undefined}>
                <strong>{step.title}</strong>
                <span>{step.owner}</span>
              </li>
            )
          })}
        </ol>
      )}

      <div className={styles.summaryStrip} role="region" aria-label="Tổng quan phương án tàu và nhân sự">
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Tàu & buồng phòng</span>
          <div className={styles.summaryValueRow}>
            <strong className={styles.summaryValue}>{state.ship ? state.ship.name : 'Chuyến chưa có tàu'}</strong>
            {state.ship && (
              <Badge
                label={formatShipStatus(state.ship.status)}
                tone={state.ship.status === 'READY' || state.ship.status === 'IN_SERVICE' ? 'success' : 'warning'}
              />
            )}
          </div>
          <span className={styles.summarySub}>
            {state.ship ? `${availableCabins}/${totalCabins} cabin sẵn sàng phục vụ` : 'Cần gán tàu trước khi kiểm tra'}
          </span>
        </div>

        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Khu vực mở, POS & dịch vụ</span>
          <div className={styles.summaryValueRow}>
            <strong className={styles.summaryValue}>
              {activeAreas.length}/{state.areas.length} khu vực mở
            </strong>
            <Badge
              label={
                activeAreas.length === 0
                  ? 'Chưa chọn khu vực'
                  : posCoveredCount === activeAreas.length && servicesCoveredCount === state.plannedServices.length
                    ? 'Đủ POS & dịch vụ'
                    : 'Cần hoàn tất POS/dịch vụ'
              }
              tone={
                activeAreas.length > 0 && posCoveredCount === activeAreas.length && servicesCoveredCount === state.plannedServices.length
                  ? 'success'
                  : 'warning'
              }
            />
          </div>
          <span className={styles.summarySub}>
            {posCoveredCount}/{activeAreas.length} khu vực đã gắn POS · {servicesCoveredCount}/{state.plannedServices.length} dịch vụ trên tàu đã bố trí
          </span>
        </div>

        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Định biên & phân công nhân sự</span>
          <div className={styles.summaryValueRow}>
            <strong className={styles.summaryValue}>
              {totalAssigned}/{totalRequired} nhân sự
            </strong>
            <Badge
              label={
                totalRequired === 0
                  ? 'Chưa định biên'
                  : missingStaffCount === 0
                    ? 'Đủ theo nhu cầu'
                    : `Thiếu ${missingStaffCount} người`
              }
              tone={totalRequired === 0 ? 'neutral' : missingStaffCount === 0 ? 'success' : 'warning'}
            />
          </div>
          <span className={styles.summarySub}>
            {state.activities.length > 0
              ? `${needs.length} vị trí khu vực · ${activitiesCoveredCount}/${state.activities.length} ca hoạt động/tour bờ`
              : `${needs.length} vị trí định biên tại khu vực mở`}
          </span>
        </div>
      </div>

      {current.shipPlanStale && (
        <Notice title="Cấu hình phục vụ trên tàu đã thay đổi" tone="warning">
          Dữ liệu tàu, POS hoặc chương trình phục vụ đã thay đổi sau khi Quản lý tàu xác nhận. Cần trả yêu cầu về Quản lý tàu để kiểm tra và xác nhận lại.
        </Notice>
      )}

      <Panel title="Tàu và chương trình phục vụ">
        <div className={styles.section}>
          <p>
            {state.ship
              ? `${state.ship.name} · ${formatShipStatus(state.ship.status)} · ${totalCabins} cabin (${availableCabins} sẵn sàng)`
              : 'Chuyến chưa có tàu'}
          </p>
          {!!state.ship?.cabins.length && (
            <details className={styles.details}>
              <summary>Xem tình trạng cabin ({totalCabins} phòng)</summary>
              <ul className={styles.cabinGrid}>
                {state.ship.cabins.map(cabin => (
                  <li key={cabin.cabinId} className={styles.cabinItem}>
                    <strong>Cabin {cabin.number}</strong>
                    <Badge
                      label={formatCabinStatus(cabin.status)}
                      tone={cabin.status === 'AVAILABLE' ? 'success' : 'warning'}
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ship && !legacyShip && (
            <fieldset disabled={disabled} className={styles.fieldsetBox}>
              <legend>Bước 1: Khu vực mở và số người cần</legend>
              <p className={styles.statusNote}>
                Chọn các khu vực dịch vụ thực sự hoạt động trong chuyến này và nhập định biên theo từng vị trí. Khu vực không mở sẽ không bắt buộc gắn máy POS hoặc phân công nhân sự.
                {working.areas.length > 0 && ` Đang chọn ${working.areas.length} khu vực · Tổng định biên nháp: ${draftHeadcount} người.`}
              </p>
              <div className={styles.areaGrid}>
                {state.areas.map(area => {
                  const checked = working.areas.includes(area.areaId)
                  const areaNeeds = working.needs.filter(need => need.areaId === area.areaId)
                  const areaMissingNeed = checked && areaNeeds.length === 0
                  return (
                    <div key={area.areaId} className={`${styles.areaCard} ${checked ? styles.areaCardActive : ''}`.trim()}>
                      <div className={styles.areaCheckRow}>
                        <label className={styles.areaCheckLabel}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => setDraft({
                              areas: event.target.checked
                                ? [...working.areas, area.areaId]
                                : working.areas.filter(id => id !== area.areaId),
                              needs: working.needs.filter(need => need.areaId !== area.areaId),
                            })}
                          />
                          <span>{area.name}</span>
                        </label>
                        <div className={styles.rowMeta}>
                          <Badge
                            label={area.eligibleTerminals.length ? `${area.eligibleTerminals.length} máy POS hợp lệ` : 'Chưa có POS hợp lệ'}
                            tone={area.eligibleTerminals.length ? 'info' : 'warning'}
                          />
                          {checked && (
                            <Badge
                              label={areaNeeds.length ? `${areaNeeds.length} vị trí cần người` : 'Chưa nhập số người'}
                              tone={areaNeeds.length ? 'success' : 'warning'}
                            />
                          )}
                        </div>
                      </div>
                      {checked && (
                        <>
                          <div className={styles.positionGrid}>
                            {state.positionOptions.map(position => {
                              const id = `staffing-${area.areaId}-${position}`
                              const count = working.needs.find(need => need.areaId === area.areaId && need.positionCode === position)?.count ?? ''
                              const invalidCount = count !== '' && (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 2147483647)
                              return (
                                <Field
                                  key={id}
                                  htmlFor={id}
                                  label={positionLabels[position] ?? position}
                                  hint="Để trống nếu khu vực không cần vị trí này"
                                  error={invalidCount ? 'Nhập số nguyên dương từ 1 trở lên.' : undefined}
                                >
                                  <input
                                    id={id}
                                    type="number"
                                    min={1}
                                    max={2147483647}
                                    step={1}
                                    placeholder="Số người cần"
                                    value={count}
                                    onChange={event => {
                                      const next = working.needs.filter(need => need.areaId !== area.areaId || need.positionCode !== position)
                                      if (event.target.value) next.push({ areaId: area.areaId, positionCode: position, count: event.target.value })
                                      setDraft({ ...working, needs: next })
                                    }}
                                  />
                                </Field>
                              )
                            })}
                          </div>
                          {areaMissingNeed && (
                            <p className={styles.blockerHint}>
                              Khu vực mở cần nhập số lượng (tối thiểu 1 người) cho ít nhất một vị trí.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className={styles.actions}>
                <Button
                  autoWidth
                  disabled={disabled || invalid || !draft}
                  onClick={() => void mutate(async () => {
                    const updated = await staffingApi.saveShipPlan(
                      current,
                      working.areas,
                      working.needs.map(({ areaId, positionCode, count }) => ({
                        areaId,
                        positionCode,
                        requiredCount: Number(count),
                      })),
                    )
                    setDraft(undefined)
                    return updated
                  })}
                >
                  Lưu khu vực và nhu cầu
                </Button>
                {draft && (
                  <Button tone="secondary" autoWidth disabled={disabled} onClick={() => setDraft(undefined)}>
                    Hủy thay đổi chưa lưu
                  </Button>
                )}
                {draft && !invalid && (
                  <span className={styles.blockerHint}>
                    Bạn có thay đổi khu vực hoặc nhu cầu chưa lưu. Hãy bấm &ldquo;Lưu khu vực và nhu cầu&rdquo; trước khi gắn POS hoặc xác nhận.
                  </span>
                )}
              </div>
            </fieldset>
          )}

          {activeAreas.length > 0 && (
            <div className={styles.subSection}>
              <div className={styles.sectionHeadingRow}>
                <h3>{editingPlacement ? 'Bước 2: Gán máy POS cho từng khu vực mở' : 'Khu vực mở và máy POS phục vụ'}</h3>
                <span className={styles.subtle}>{posCoveredCount}/{activeAreas.length} khu vực đã gắn POS</span>
              </div>
              <ul className={styles.rows}>
                {activeAreas.map(area => {
                  const hasPos = area.terminals.length > 0
                  const areaNeedsSummary = needs
                    .filter(need => need.areaId === area.areaId)
                    .map(need => `${positionLabels[need.positionCode] ?? need.positionCode}: ${need.requiredCount} người`)
                    .join(' · ')
                  return (
                    <li className={styles.row} key={area.areaId}>
                      <div className={styles.rowMain}>
                        <strong>{area.name}</strong>
                        {areaNeedsSummary && <small className={styles.subtle}>Định biên đã lưu: {areaNeedsSummary}</small>}
                      </div>
                      <div className={styles.rowMeta}>
                        <Badge
                          label={hasPos ? `POS: ${area.terminals.map(t => t.name).join(', ')}` : 'Chưa gắn máy POS'}
                          tone={hasPos ? 'success' : 'warning'}
                        />
                        {editingPlacement && (
                          <div className={styles.rowControl}>
                            <Field htmlFor={`pos-${area.areaId}`} label={`POS tại ${area.name}`}>
                              <select
                                id={`pos-${area.areaId}`}
                                disabled={disabled || Boolean(draft)}
                                value={area.terminals[0]?.terminalId ?? ''}
                                onChange={event => {
                                  const terminal = event.target.value
                                  if (terminal) void mutate(() => staffingApi.placePos(current, area.areaId, terminal))
                                }}
                              >
                                <option value="" disabled>
                                  {legacyShip || area.eligibleTerminals.length ? 'Chọn máy POS' : 'Khu vực chưa có máy POS hợp lệ'}
                                </option>
                                {(legacyShip ? state.terminalOptions : area.eligibleTerminals).map(terminal => (
                                  <option key={terminal.terminalId} value={terminal.terminalId}>{terminal.name}</option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {state.plannedServices.length > 0 && (
            <div className={styles.subSection}>
              <div className={styles.sectionHeadingRow}>
                <h3>{editingPlacement ? 'Bước 3: Bố trí dịch vụ trên tàu vào khu vực đã có POS' : 'Dịch vụ trên tàu'}</h3>
                <span className={styles.subtle}>{servicesCoveredCount}/{state.plannedServices.length} dịch vụ đã bố trí</span>
              </div>
              <ul className={styles.rows}>
                {state.plannedServices.map(service => {
                  const placed = service.placements[0]?.areaId
                  const proposal = service.proposal && <div className={styles.rowMain}>
                    <small className={styles.subtle}>Quản lý dịch vụ đề xuất {service.proposal.deckName} · {service.proposal.note}</small>
                    <small className={styles.subtle}>{{
                      PENDING: 'Đề nghị đang chờ xác nhận',
                      CONFIRMED: 'Đề nghị đã được xác nhận',
                      RETURNED: 'Đề nghị đã trả về Quản lý dịch vụ',
                    }[service.proposal.status]}</small>
                    {ship && service.proposal.status === 'PENDING' && (
                      <ButtonLink to={`/admin/service-locations?cruiseId=${encodeURIComponent(current.cruiseId)}`}
                        tone="secondary" size="compact" autoWidth>Xử lý đề nghị</ButtonLink>
                    )}
                  </div>
                  const placedArea = activeAreas.find(area => area.areaId === placed)
                  const candidates = activeAreas.filter(area => service.eligibleAreaIds.includes(area.areaId) && area.terminals.length)
                  const eligibleNames = state.areas
                    .filter(area => service.eligibleAreaIds.includes(area.areaId))
                    .map(area => area.name)
                    .join(', ')
                  if (!editingPlacement) {
                    return (
                      <li key={service.serviceId} className={styles.row}>
                        <div className={styles.rowMain}>
                          <strong>{service.name}</strong>
                          {proposal}
                          <small className={styles.subtle}>
                            {placedArea ? `Phục vụ tại ${placedArea.name}` : 'Chưa bố trí khu vực phục vụ'}
                          </small>
                        </div>
                        <Badge
                          label={placedArea ? placedArea.name : 'Chưa bố trí'}
                          tone={placedArea ? 'success' : 'warning'}
                        />
                      </li>
                    )
                  }
                  return (
                    <li key={service.serviceId} className={styles.row}>
                      <div className={styles.rowMain}>
                        <strong>{service.name}</strong>
                        {proposal}
                        <small className={styles.subtle}>
                          {candidates.length > 0
                            ? `Có ${candidates.length} khu vực mở đủ điều kiện POS`
                            : eligibleNames
                              ? `Cần mở và gắn POS cho khu vực hợp lệ (${eligibleNames})`
                              : 'Chưa có khu vực hợp lệ trên tàu cho dịch vụ này'}
                        </small>
                      </div>
                      <div className={styles.rowControl}>
                        <Field key={service.serviceId} htmlFor={`service-${service.serviceId}`} label={service.name}>
                          <select
                            id={`service-${service.serviceId}`}
                            disabled={disabled || Boolean(draft)}
                            value={placed ?? ''}
                            onChange={event => {
                              const area = candidates.find(option => option.areaId === event.target.value)
                              if (area) void mutate(() => staffingApi.placeService(current, service.serviceId, area.areaId, area.terminals[0].terminalId))
                            }}
                          >
                            <option value="" disabled>Chọn khu vực đã có POS</option>
                            {candidates.map(area => <option key={area.areaId} value={area.areaId}>{area.name}</option>)}
                          </select>
                        </Field>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      {!ship && (
        <Panel title="Nhu cầu và nhân viên đã phân công">
          <div className={styles.section}>
            {options.error && (
              <Notice title="Chưa tải được nhân viên" tone="error">
                <Button tone="text" onClick={options.retry}>Thử lại</Button>
              </Notice>
            )}
            {!needs.length && <p className={styles.statusNote}>Chuyến này chưa có nhu cầu tại khu vực dịch vụ.</p>}
            {needs.length > 0 && (
              <ul className={styles.rows}>
                {needs.map(need => {
                  const assigned = need.assignedUserIds
                  const gap = Math.max(0, need.requiredCount - assigned.length)
                  const used = new Set(needs.flatMap(item => item.assignedUserIds))
                  const candidates = (options.data?.users ?? []).filter(user => user.allowedRoles.includes(need.positionCode)
                    && !used.has(user.userId) && (state.staff.find(staff => staff.userId === user.userId)?.role ?? need.positionCode) === need.positionCode)
                  return (
                    <li className={styles.row} key={need.needId}>
                      <div className={styles.rowMain}>
                        <strong>{need.areaName} · {positionLabels[need.positionCode] ?? need.positionCode}</strong>
                        <div className={styles.rowMeta}>
                          <span className={styles.subtle}>{assigned.length}/{need.requiredCount} đã phân công</span>
                          <Badge
                            label={gap === 0 ? 'Đủ người' : `Thiếu ${gap} người`}
                            tone={gap === 0 ? 'success' : 'warning'}
                          />
                        </div>
                        {assigned.length > 0 && (
                          <div className={styles.assignedList}>
                            {assigned.map(userId => (
                              <div className={styles.assignedChip} key={userId}>
                                <span>{name(userId)}</span>
                                {hr && (
                                  <Button
                                    size="compact"
                                    tone="text"
                                    autoWidth
                                    disabled={disabled}
                                    onClick={() => void mutate(() => staffingApi.assignNeed(current, need.needId, userId, false))}
                                  >
                                    Bỏ khỏi vị trí
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {hr && assigned.length < need.requiredCount && (
                        <div className={styles.rowControl}>
                          <Field
                            htmlFor={`hire-${need.needId}`}
                            label="Chọn nhân viên"
                            hint={candidates.length ? `${candidates.length} nhân viên đủ điều kiện khả dụng` : 'Chưa có thêm nhân viên phù hợp'}
                          >
                            <select
                              id={`hire-${need.needId}`}
                              value=""
                              disabled={disabled || options.loading}
                              onChange={event => {
                                const userId = event.target.value
                                if (userId) void mutate(() => staffingApi.assignNeed(current, need.needId, userId, true))
                              }}
                            >
                              <option value="" disabled>{candidates.length ? 'Chọn nhân viên đủ điều kiện' : 'Chưa có người phù hợp'}</option>
                              {candidates.map(user => <option key={user.userId} value={user.userId}>{user.username}</option>)}
                            </select>
                          </Field>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {!!state.activities.length && (
              <div className={styles.subSection}>
                <div className={styles.sectionHeadingRow}>
                  <h3>Ca hoạt động trên tàu và tour tham quan trên bờ</h3>
                  <span className={styles.subtle}>{activitiesCoveredCount}/{state.activities.length} ca đã có người phụ trách</span>
                </div>
                <ul className={styles.rows}>
                  {state.activities.map(activity => {
                    const hasStaff = activity.staffIds.length > 0
                    return (
                      <li key={activity.activityId} className={styles.row}>
                        <div className={styles.rowMain}>
                          <strong>{activity.name}</strong>
                          <small className={styles.subtle}>
                            {formatActivityKind(activity.kind)} · {hasStaff ? `Phụ trách: ${activity.staffIds.map(name).join(', ')}` : 'Chưa phân ca'}
                          </small>
                        </div>
                        <Badge
                          label={hasStaff ? `${activity.staffIds.length} nhân sự` : 'Chưa phân ca'}
                          tone={hasStaff ? 'success' : 'warning'}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      )}

      {error && <Notice title="Chưa lưu được thay đổi" tone="error">{error}</Notice>}
      {stale && (
        <Notice title="Yêu cầu đã thay đổi" tone="warning">
          Bản nhập của bạn vẫn ở đây. Kiểm tra dữ liệu mới trước khi lưu lại.
          <Button
            tone="text"
            disabled={details.loading || Boolean(details.error)}
            onClick={() => {
              setLatest(undefined)
              setStale(false)
              setError('')
            }}
          >
            Dùng phiên bản mới
          </Button>
        </Notice>
      )}

      {action && (
        <div className={styles.section}>
          {Boolean(draft) && (
            <p className={styles.blockerHint}>
              Lưu hoặc hủy thay đổi ở mục &ldquo;Bước 1: Khu vực mở và số người cần&rdquo; trước khi xác nhận phương án tàu.
            </p>
          )}
          {!draft && ship && !legacyShip && (activeAreas.length === 0 || posCoveredCount < activeAreas.length || servicesCoveredCount < state.plannedServices.length) && (
            <p className={styles.blockerHint}>
              Trước khi xác nhận phương án tàu, cần hoàn tất: {activeAreas.length === 0 ? 'chọn và lưu khu vực mở có nhu cầu nhân sự; ' : ''}
              {posCoveredCount < activeAreas.length ? `gắn máy POS cho ${activeAreas.length - posCoveredCount} khu vực mở còn thiếu; ` : ''}
              {servicesCoveredCount < state.plannedServices.length ? `bố trí khu vực/POS cho ${state.plannedServices.length - servicesCoveredCount} dịch vụ trên tàu.` : ''}
            </p>
          )}
          {hr && missingStaffCount > 0 && (
            <p className={styles.blockerHint}>
              Còn thiếu {missingStaffCount} nhân sự theo định biên khu vực. Hãy phân công đủ người trước khi gửi, hoặc bấm &ldquo;{action.backLabel}&rdquo; để trả Quản lý tàu điều chỉnh khu vực/nhu cầu.
            </p>
          )}
          {hr && missingStaffCount === 0 && missingActivitiesCount > 0 && (
            <p className={styles.blockerHint}>
              Đã đủ định biên khu vực nhưng còn {missingActivitiesCount} ca hoạt động/tour bờ chưa phân ca. Hãy phân ca ở mục bên dưới trước khi gửi phương án.
            </p>
          )}
          {action.back === 'SHIP_RETURN_ASM' && state.canReturnToAsm === false && (
            <Notice tone="warning" title="Chương trình đang khóa">
              Nhờ Quản lý lịch trình rút hồ sơ đang chờ duyệt hoặc Quản lý vận hành yêu cầu bổ sung kế hoạch để Quản lý dịch vụ chỉnh sửa.
            </Notice>
          )}
          {returning && (
            <Field
              htmlFor="staffing-v2-return"
              label="Lý do trả yêu cầu"
              hint="Ghi rõ khu vực, vị trí, số người thiếu hoặc nội dung cần bộ phận trước kiểm tra lại."
            >
              <textarea
                id="staffing-v2-return"
                value={reason}
                onChange={event => setReason(event.target.value)}
                disabled={disabled}
              />
            </Field>
          )}
          <div className={styles.actions}>
            {action.approve && !returning && (
              <Button
                disabled={disabled || Boolean(draft) || current.shipPlanStale || (hr && staffingMissing(current) > 0)}
                busy={busy}
                onClick={() => {
                  const next = action.approve
                  if (next) void mutate(() => staffingApi.transition(current, next), true)
                }}
              >
                {action.label}
              </Button>
            )}
            {action.back && (
              <Button
                tone={returning ? 'primary' : 'secondary'}
                busy={returning && busy}
                disabled={disabled || (action.back === 'SHIP_RETURN_ASM' && state.canReturnToAsm === false) || (returning && !reason.trim())}
                onClick={() => {
                  const previous = action.back
                  if (returning && previous) void mutate(() => staffingApi.transition(current, previous, reason.trim()), true)
                  else setReturning(true)
                }}
              >
                {action.backLabel}
              </Button>
            )}
            {returning && (
              <Button
                tone="secondary"
                autoWidth
                disabled={disabled}
                onClick={() => {
                  setReturning(false)
                  setReason('')
                }}
              >
                Hủy
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
