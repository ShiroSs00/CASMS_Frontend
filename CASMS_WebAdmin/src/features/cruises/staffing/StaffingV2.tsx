import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { Badge, Button, ButtonLink, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { cruiseStaffApi } from '../api/cruise-staff-api'
import {
  positionLabels, staffingApi, staffingCabinStatusLabels, staffingError, staffingMissing, staffingShipStatusLabels,
  type NeedInput, type ReviewDetails, type StaffingAction, type StaffingRequest,
} from './staffing-api'
import styles from './Staffing.module.css'
import { placementGuidance, placementKey, requiresReviewReload, resetImpactCopy, servicePlacementChoices, shipReviewReady } from './ship-review'

const actions = {
  PENDING_SHIP_REVIEW: { approve: 'SHIP_CHECKED', label: 'Xác nhận phương án tàu', back: 'SHIP_RETURN_ASM', backLabel: 'Trả Quản lý dịch vụ bổ sung chương trình' },
  SHIP_REVIEWED: { approve: 'SEND_TO_HR', label: 'Gửi Quản lý nhân sự phân công', back: 'CRM_RETURN_SHIP', backLabel: 'Trả Quản lý tàu' },
  SENT_TO_HR: { approve: 'HR_SUBMITTED', label: 'Gửi phương án cho Quản lý lịch trình', back: 'HR_RETURN_SHIP', backLabel: 'Báo thiếu hoặc yêu cầu kiểm tra lại tàu' },
  HR_SUBMITTED: { approve: 'PLANNER_CONFIRMED', label: 'Gửi Quản lý vận hành duyệt', back: 'CRM_RETURN_HR', backLabel: 'Trả Quản lý nhân sự bổ sung' },
  PLANNER_CONFIRMED: { approve: 'OPS_APPROVED', label: 'Duyệt phương án nhân sự', back: 'OPS_RETURN_CRM', backLabel: 'Trả Quản lý lịch trình' },
} satisfies Record<string, { approve: StaffingAction; label: string; back: StaffingAction; backLabel: string }>

const v2Steps = [
  { id: 'asm', title: 'Chương trình', owner: 'Quản lý dịch vụ', statuses: ['PENDING_ASM'] },
  { id: 'ship', title: 'Khu vực, POS & nhu cầu', owner: 'Quản lý tàu', statuses: ['PENDING_SHIP_REVIEW'] },
  { id: 'dispatch', title: 'Kiểm tra & gửi nhân sự', owner: 'Quản lý lịch trình', statuses: ['SHIP_REVIEWED'] },
  { id: 'hr', title: 'Phân công nhân sự', owner: 'Quản lý nhân sự', statuses: ['SENT_TO_HR'] },
  { id: 'approval', title: 'Kiểm tra & phê duyệt', owner: 'Quản lý lịch trình → Quản lý vận hành', statuses: ['HR_SUBMITTED', 'PLANNER_CONFIRMED', 'OPS_APPROVED'] },
] as const

const stageGuideCopy: Readonly<Record<string, { actor: string; next: string; title: string; detail: string }>> = {
  PENDING_ASM: {
    actor: 'Quản lý dịch vụ',
    next: 'Quản lý tàu',
    title: 'Hoàn thiện chương trình & dịch vụ của chuyến',
    detail: 'Sau khi Quản lý dịch vụ chốt chương trình, yêu cầu sẽ tự động chuyển sang Quản lý tàu để mở khu vực và lập định biên.',
  },
  PENDING_SHIP_REVIEW: {
    actor: 'Quản lý tàu',
    next: 'Quản lý lịch trình',
    title: 'Mở khu vực phục vụ, gán máy POS offline và lập định biên',
    detail: 'Thực hiện lần lượt 3 bước bên dưới: (1) Chọn khu vực mở & số người cần → (2) Gán máy POS cho khu vực mở → (3) Bố trí dịch vụ vào khu vực đã có POS.',
  },
  SHIP_REVIEWED: {
    actor: 'Quản lý lịch trình',
    next: 'Quản lý nhân sự',
    title: 'Rà soát phương án tàu và chuyển sang Nhân sự phân công',
    detail: 'Kiểm tra lại danh sách khu vực mở, máy POS và định biên từ Quản lý tàu trước khi gửi sang Quản lý nhân sự.',
  },
  SENT_TO_HR: {
    actor: 'Quản lý nhân sự',
    next: 'Quản lý lịch trình',
    title: 'Phân công nhân sự cụ thể vào từng vị trí khu vực và ca hoạt động',
    detail: 'Chọn nhân viên đủ điều kiện cho từng vị trí đến khi đạt 100% định biên, sau đó gửi phương án lại cho Quản lý lịch trình.',
  },
  HR_SUBMITTED: {
    actor: 'Quản lý lịch trình',
    next: 'Quản lý vận hành',
    title: 'Kiểm tra tổng hợp nhân sự và trình Quản lý vận hành phê duyệt',
    detail: 'Đối chiếu danh sách nhân sự đã phân công theo từng khu vực và ca hoạt động trước khi trình duyệt cuối cùng.',
  },
  PLANNER_CONFIRMED: {
    actor: 'Quản lý vận hành',
    next: 'Hoàn tất duyệt',
    title: 'Phê duyệt phương án tàu và nhân sự cho chuyến khởi hành',
    detail: 'Xác nhận phương án nhân sự đáp ứng đủ điều kiện vận hành trước khi xuất bến.',
  },
  OPS_APPROVED: {
    actor: 'Đã phê duyệt',
    next: 'Sẵn sàng vận hành',
    title: 'Phương án tàu và nhân sự đã được phê duyệt hoàn tất',
    detail: 'Khu vực mở, máy POS offline và nhân sự phụ trách đã được chốt cho chuyến khởi hành này.',
  },
}

function staffInitials(label: string) {
  const parts = label.replace(/[_.-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

function progressPercent(done: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

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

export function StaffingV2({ request, onChanged, onCompleted, coordinator = false, readOnly = false, refreshKey = 0, activitySection }: {
  request: StaffingRequest; onChanged: () => void; onCompleted: () => void; coordinator?: boolean; readOnly?: boolean; refreshKey?: number; activitySection?: ReactNode
}) {
  const access = useSessionAccess()
  const details = useReadQuery(`staffing-review:${request.id}:${request.revision}:${refreshKey}`,
    useCallback(signal => staffingApi.reviewDetails(request.id, signal), [request.id]))
  const [latest, setLatest] = useState<{ key: number; data: ReviewDetails }>()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [reason, setReason] = useState('')
  const [returning, setReturning] = useState(false)
  const [confirmation, setConfirmation] = useState<{ message: string; revision: number; run: () => void }>()
  const [draft, setDraft] = useState<{ areas: string[]; needs: (Omit<NeedInput, 'requiredCount'> & { count: string })[] }>()
  const state = latest && latest.key === refreshKey && latest.data.request.revision > (details.data?.request.revision ?? 0)
    ? latest.data
    : details.data
  const stage = state?.request.status ?? request.status
  const ship = !readOnly && !coordinator && stage === 'PENDING_SHIP_REVIEW'
    && access.roles.includes('SHIP_MANAGER') && access.has('CRUISE_PREPARATION_READ')
  const hr = !readOnly && !coordinator && stage === 'SENT_TO_HR'
    && access.roles.includes('HR_MANAGER') && access.canDo('CRUISE_STAFF_ASSIGN')
  const crm = coordinator && access.roles.includes('CRUISE_MANAGER') && access.canDo('CRUISE_PREPARATION_SUBMIT')
  const ops = !coordinator && stage === 'PLANNER_CONFIRMED'
    && access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_VALIDATE')
  const options = useReadQuery('staffing-need-candidates:' + request.cruiseId,
    useCallback(signal => hr ? cruiseStaffApi.options(request.cruiseId, signal) : Promise.resolve(null), [request.cruiseId, hr]))

  async function mutate(change: () => Promise<ReviewDetails | StaffingRequest>, finish = false) {
    if (lock.current || stale) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const result = await change()
      if ('request' in result) setLatest({ key: refreshKey, data: result })
      else if (!finish && state) {
        setLatest({ key: refreshKey, data: { ...state, request: result } })
        details.retry()
        options.retry()
      }
      if (finish) onCompleted()
      else onChanged()
    } catch (cause) {
      setError(staffingError(cause))
      if (mutationOutcomeUnknown(cause) || cause instanceof ApiError && requiresReviewReload(cause.code)) {
        setLatest(undefined)
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

  if (!state && !stale) {
    if (details.loading) return <Loading label="Đang tải phương án…" />
    return <Notice title="Chưa tải được phương án" tone="error">
      {staffingError(details.error)} <Button tone="text" onClick={details.retry}>Thử lại</Button>
    </Notice>
  }
  if (!state) return <Notice title="Cần tải lại phương án" tone="warning">
    <p>{error}</p>
    {details.loading ? <Loading label="Đang tải phương án mới…" /> :
      <Button tone="secondary" onClick={details.retry}>Tải lại phương án</Button>}
  </Notice>
  const current = state.request
  const legacyShip = ship && current.workflowVersion !== 'V2'
  const editingPlacement = ship && (!legacyShip || current.asmProgramWorkflow)
  const action = readOnly
    ? undefined
    : legacyShip
      ? { approve: 'SHIP_CHECKED' as const, label: 'Xác nhận phương án tàu', back: undefined, backLabel: '' }
      : crm && (current.shipPlanStale || current.status === 'OPS_APPROVED')
        ? { approve: undefined, label: '', back: 'CRM_RETURN_SHIP' as const, backLabel: 'Trả Quản lý tàu kiểm tra lại' }
        : ship || hr || ops || crm && (stage === 'SHIP_REVIEWED' || stage === 'HR_SUBMITTED')
          ? actions[current.status as keyof typeof actions]
          : undefined
  const selected = current.activeAreaIds ?? []
  const needs = current.needs ?? []
  const activeAreas = state.areas.filter(area => legacyShip || selected.includes(area.areaId))
  const ready = shipReviewReady(state)
  const canAssignNeeds = hr && !current.shipPlanStale
  const placementNotApplicable = current.workflowVersion === 'V2' && ready
    && activeAreas.length === 0 && state.plannedServices.length === 0
  const hasAreaPlanning = state.areas.length > 0 || state.plannedServices.length > 0
    || selected.length > 0 || needs.length > 0
  const working = draft ?? {
    areas: selected,
    needs: needs.map(need => ({ areaId: need.areaId, positionCode: need.positionCode, count: String(need.requiredCount) })),
  }
  const invalid = working.areas.some(area => !working.needs.some(need => need.areaId === area))
    || working.needs.some(need => !/^\d+$/.test(need.count) || Number(need.count) < 1 || Number(need.count) > 2147483647)
  const disabled = busy || stale || details.loading || Boolean(details.error) || current.revision < request.revision
  function confirmImpact(action: 'save' | StaffingAction, run: () => void) {
    const message = resetImpactCopy(current, action)
    if (message) setConfirmation({ message, revision: current.revision, run })
    else run()
  }
  const name = (id: string) =>
    state.staff.find(staff => staff.userId === id)?.username
    ?? options.data?.users.find(user => user.userId === id)?.username
    ?? id

  const totalCabins = state.ship?.cabins.length ?? 0
  const availableCabins = state.ship?.cabins.filter(cabin => cabin.status === 'AVAILABLE').length ?? 0
  const posCoveredCount = activeAreas.filter(area => area.terminals.length > 0).length
  const servicesCoveredCount = state.plannedServices.filter(service => {
    return service.placements.some(placement => current.workflowVersion === 'V2'
      ? servicePlacementChoices(state, service).some(choice => placementKey(choice) === placementKey(placement))
      : activeAreas.some(area => area.areaId === placement.areaId))
  }).length
  const totalRequired = needs.reduce((sum, need) => sum + need.requiredCount, 0)
  const noStaffingDemand = current.workflowVersion === 'V2' && totalRequired === 0 && state.activities.length === 0
  const totalAssigned = needs.reduce((sum, need) => sum + need.assignedUserIds.length, 0)
  const missingStaffCount = staffingMissing(current)
  const activitiesCoveredCount = state.activities.filter(activity => activity.staffIds.length > 0).length
  const missingActivitiesCount = Math.max(0, state.activities.length - activitiesCoveredCount)
  const draftHeadcount = working.needs.reduce((sum, item) => sum + (/^\d+$/.test(item.count) ? Number(item.count) : 0), 0)

  const currentStepIndex = v2Steps.findIndex(step => (step.statuses as readonly string[]).includes(current.status))
  const stageGuide = stageGuideCopy[current.status]
  const workflowSteps = (
    <ol className={styles.workflowStepper} aria-label="Tiến độ quy trình chuẩn bị nhân sự">
      {v2Steps.map((step, index) => {
        const approved = current.status === 'OPS_APPROVED'
        const done = approved || index < currentStepIndex
        const active = !approved && index === currentStepIndex
        return (
          <li key={step.id} aria-current={active ? 'step' : undefined}
            className={`${styles.workflowStep} ${done ? styles.workflowStepDone : active ? styles.workflowStepCurrent : ''}`}>
            <span className={styles.workflowStepMarker} aria-hidden="true">{done ? '✓' : index + 1}</span>
            <div className={styles.workflowStepBody}>
              <strong>{step.title}</strong>
              <span>{step.owner}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )

  const shipProgramContent = (
    <div className={styles.section}>
      {!!state.ship?.cabins.length && (
        <details className={styles.details}>
          <summary>Xem tình trạng cabin ({availableCabins}/{totalCabins} sẵn sàng)</summary>
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
      {placementNotApplicable && <p className={styles.subtle}>Không áp dụng cấu hình khu vực phục vụ và POS cho chuyến này.</p>}

      {ship && !legacyShip && hasAreaPlanning && (
        <fieldset disabled={disabled} className={styles.fieldsetBox}>
          <legend>Bước 1: Khu vực mở và số người cần</legend>
          <div className={styles.stepSectionHead}>
            <div className={styles.stepSectionTitleGroup}>
              <span className={`${styles.stepBadgeNum} ${activeAreas.length > 0 && !draft ? styles.stepBadgeDone : ''}`} aria-hidden="true">
                {activeAreas.length > 0 && !draft ? '✓' : '1'}
              </span>
              <strong>Chọn khu vực mở và nhập định biên nhân sự</strong>
            </div>
            <Badge
              label={draft ? 'Có thay đổi chưa lưu' : activeAreas.length > 0 ? `Đã lưu ${activeAreas.length} khu vực · ${totalRequired} người` : 'Chưa chọn khu vực'}
              tone={draft ? 'warning' : activeAreas.length > 0 ? 'success' : 'neutral'}
            />
          </div>
          <p className={styles.statusNote}>
            Tick chọn khu vực hoạt động trong chuyến và nhập số người cho vị trí cần dùng (để trống vị trí không cần).
            {working.areas.length > 0 && ` Đang chọn ${working.areas.length} khu vực · Tổng định biên: ${draftHeadcount} người.`}
          </p>
          <div className={styles.areaGrid}>
            {state.areas.length === 0 && (
              <Notice tone="warning" title="Tàu chưa có khu vực dịch vụ hoặc máy POS offline">
                Tàu này chưa được gắn dịch vụ vào khu vực 3D hoặc chưa đăng ký máy POS offline. Quản trị hệ thống cần vào Hồ sơ tàu → Khu vực dịch vụ để cấu hình trước khi Quản lý tàu chọn khu vực mở và lập định biên nhân sự.
              </Notice>
            )}
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
                              error={invalidCount ? 'Nhập số nguyên dương từ 1 trở lên.' : undefined}
                            >
                              <input
                                id={id}
                                type="number"
                                min={1}
                                max={2147483647}
                                step={1}
                                placeholder="Để trống nếu không cần"
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
              onClick={() => confirmImpact('save', () => void mutate(async () => {
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
              }))}
            >
              Lưu khu vực và nhu cầu
            </Button>
            {draft && (
              <Button tone="secondary" autoWidth disabled={disabled} onClick={() => setDraft(undefined)}>
                Hủy thay đổi chưa lưu
              </Button>
            )}
          </div>
        </fieldset>
      )}

      {activeAreas.length > 0 && (
        <div className={styles.subSection}>
          <div className={styles.stepSectionHead}>
            <div className={styles.stepSectionTitleGroup}>
              {editingPlacement && (
                <span className={`${styles.stepBadgeNum} ${posCoveredCount === activeAreas.length ? styles.stepBadgeDone : ''}`} aria-hidden="true">
                  {posCoveredCount === activeAreas.length ? '✓' : '2'}
                </span>
              )}
              <h3>{editingPlacement ? 'Gán máy POS offline cho từng khu vực mở' : 'Khu vực mở và máy POS phục vụ'}</h3>
            </div>
            <Badge
              label={`${posCoveredCount}/${activeAreas.length} khu vực đã gắn POS`}
              tone={posCoveredCount === activeAreas.length ? 'success' : 'warning'}
            />
          </div>
          <ul className={styles.rows}>
            {activeAreas.map(area => {
              const hasPos = area.terminals.length > 0
              const posChoices = legacyShip ? state.terminalOptions : area.eligibleTerminals
              const areaNeedsSummary = needs
                .filter(need => need.areaId === area.areaId)
                .map(need => `${positionLabels[need.positionCode] ?? need.positionCode}: ${need.requiredCount} người`)
                .join(' · ')
              return (
                <li className={styles.row} key={area.areaId}>
                  <div className={styles.rowMain}>
                    <strong>{area.name}</strong>
                    {areaNeedsSummary && <small className={styles.subtle}>{areaNeedsSummary}</small>}
                  </div>
                  <div className={styles.rowMeta}>
                    <Badge
                      label={hasPos ? `POS: ${area.terminals.map(t => t.name).join(', ')}` : 'Chưa gắn máy POS'}
                      tone={hasPos ? 'success' : 'warning'}
                    />
                    {editingPlacement && (
                      <div className={styles.rowControl}>
                        <Field htmlFor={`pos-${area.areaId}`} label="Máy POS">
                          <select
                            id={`pos-${area.areaId}`}
                            disabled={disabled || Boolean(draft) || posChoices.length === 0}
                            value={area.terminals.find(terminal => posChoices.some(choice => choice.terminalId === terminal.terminalId))?.terminalId ?? ''}
                            onChange={event => {
                              const terminal = event.target.value
                              if (posChoices.some(choice => choice.terminalId === terminal)) {
                                void mutate(() => staffingApi.placePos(current, area.areaId, terminal))
                              }
                            }}
                          >
                            <option value="" disabled>
                              {legacyShip || area.eligibleTerminals.length ? 'Chọn máy POS' : 'Chưa có máy POS hợp lệ'}
                            </option>
                            {posChoices.map(terminal => (
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
          <div className={styles.stepSectionHead}>
            <div className={styles.stepSectionTitleGroup}>
              {editingPlacement && (
                <span className={`${styles.stepBadgeNum} ${servicesCoveredCount === state.plannedServices.length ? styles.stepBadgeDone : ''}`} aria-hidden="true">
                  {servicesCoveredCount === state.plannedServices.length ? '✓' : '3'}
                </span>
              )}
              <h3>{editingPlacement ? 'Bố trí dịch vụ trên tàu vào khu vực đã có POS' : 'Dịch vụ trên tàu'}</h3>
            </div>
            <Badge
              label={`${servicesCoveredCount}/${state.plannedServices.length} dịch vụ đã bố trí`}
              tone={servicesCoveredCount === state.plannedServices.length ? 'success' : 'warning'}
            />
          </div>
          <ul className={styles.rows}>
            {state.plannedServices.map(service => {
              const proposalStatus = service.proposal ? {
                PENDING: 'chờ xác nhận',
                CONFIRMED: 'đã xác nhận',
                RETURNED: 'đã trả bổ sung',
              }[service.proposal.status] : ''
              const proposal = service.proposal && (
                <div className={styles.rowMeta}>
                  <small className={styles.subtle}>
                    Đề xuất: {service.proposal.deckName} ({proposalStatus}){service.proposal.note ? ` · ${service.proposal.note}` : ''}
                  </small>
                  {ship && service.proposal.status === 'PENDING' && (
                    <ButtonLink to={`/admin/service-locations?cruiseId=${encodeURIComponent(current.cruiseId)}`}
                      tone="secondary" size="compact" autoWidth>Xử lý đề nghị</ButtonLink>
                  )}
                </div>
              )
              const candidates = servicePlacementChoices(state, service)
              const placed = service.placements.find(item =>
                candidates.some(candidate => placementKey(candidate) === placementKey(item)))
              const pairLabel = ({ areaId, terminalId }: typeof candidates[number]) => {
                const area = state.areas.find(item => item.areaId === areaId)
                const terminal = area?.terminals.find(item => item.terminalId === terminalId)
                  ?? area?.eligibleTerminals.find(item => item.terminalId === terminalId)
                return `${area?.name ?? 'Khu vực phục vụ'} · ${terminal?.name ?? 'Máy POS'}`
              }
              const configuredLabels = (service.configuredPlacements ?? []).map(pairLabel)
              const blocker = service.placementBlocker && placementGuidance[service.placementBlocker]
              if (!editingPlacement) {
                return (
                  <li key={service.serviceId} className={styles.row}>
                    <div className={styles.rowMain}>
                      <strong>{service.name}</strong>
                      {proposal}
                      {blocker && <small className={styles.subtle}>{blocker}</small>}
                    </div>
                    <Badge
                      label={placed ? pairLabel(placed) : 'Chưa có bố trí hợp lệ'}
                      tone={placed ? 'success' : 'warning'}
                    />
                  </li>
                )
              }
              return (
                <li key={service.serviceId} className={styles.row}>
                  <div className={styles.rowMain}>
                    <strong>{service.name}</strong>
                    {proposal}
                    {candidates.length === 0 && (
                      <small className={styles.subtle}>
                        {blocker ?? 'Chưa có cặp khu vực và POS đủ điều kiện.'}
                      </small>
                    )}
                    {configuredLabels.length > 0 && (
                      <div className={styles.flowTagRow}>
                        <span className={styles.flowTag}>Cặp đủ điều kiện</span>
                        {configuredLabels.map(label => (
                          <span key={label} className={`${styles.flowTag} ${styles.flowTagAccent}`}>{label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.rowControl}>
                    <Field htmlFor={`service-${service.serviceId}`} label="Khu vực và máy POS">
                      <select
                        id={`service-${service.serviceId}`}
                        disabled={disabled || Boolean(draft) || candidates.length === 0}
                        value={placed ? placementKey(placed) : ''}
                        onChange={event => {
                          const pair = candidates.find(option => placementKey(option) === event.target.value)
                          if (pair) void mutate(() => staffingApi.placeService(current, service.serviceId, pair.areaId, pair.terminalId))
                        }}
                      >
                        <option value="" disabled>Chọn khu vực đã có POS</option>
                        {candidates.map(pair => <option key={placementKey(pair)} value={placementKey(pair)}>{pairLabel(pair)}</option>)}
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
  )

  const staffingAssignmentPanel = !ship && (
    <Panel title={hr ? '1. Phân công nhân sự theo định biên khu vực' : 'Nhu cầu và nhân viên đã phân công'}>
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
                    <div className={styles.needProgressWrap} aria-hidden="true">
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${gap === 0 ? styles.progressFillSuccess : styles.progressFillWarn}`}
                          style={{ width: `${progressPercent(assigned.length, need.requiredCount)}%` }}
                        />
                      </div>
                    </div>
                    {assigned.length > 0 && (
                      <>
                        <div className={styles.assignedList}>
                          {assigned.map(userId => {
                            const displayName = name(userId)
                            return (
                              <div className={styles.assignedChip} key={userId}>
                                <span className={styles.staffAvatar} aria-hidden="true">{staffInitials(displayName)}</span>
                                <span>{displayName}</span>
                                {canAssignNeeds && (
                                  <Button
                                    size="compact"
                                    tone="text"
                                    autoWidth
                                    title="Chỉ gỡ khỏi nhu cầu khu vực này; nhân sự vẫn thuộc danh sách thành viên chuyến."
                                    disabled={disabled}
                                    onClick={() => void mutate(() => staffingApi.assignNeed(current, need.needId, userId, false))}
                                  >
                                    Bỏ khỏi nhu cầu
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {canAssignNeeds && (
                          <small className={styles.subtle}>
                            “Bỏ khỏi nhu cầu” chỉ gỡ nhân sự khỏi vị trí khu vực này; để gỡ hẳn khỏi chuyến, thao tác ở mục Nhân sự đã phân công vào chuyến bên dưới.
                          </small>
                        )}
                      </>
                    )}
                  </div>
                  {canAssignNeeds && assigned.length < need.requiredCount && (
                    <div className={styles.rowControl}>
                      <Field
                        htmlFor={`hire-${need.needId}`}
                        label="Chọn nhân viên"
                        hint={candidates.length ? `${candidates.length} nhân viên khả dụng` : 'Chưa có thêm nhân viên phù hợp'}
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
                      {candidates.length === 0 && access.canDo('USER_CREATE') && (
                        <ButtonLink to="/admin/system" tone="secondary" size="compact" autoWidth>
                          Bổ sung nhân viên mới →
                        </ButtonLink>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!!state.activities.length && !(hr && activitySection) && (
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
  )

  return (
    <div className={styles.stack}>
      {current.workflowVersion === 'V2' && (
        <>
          <div className={styles.desktopWorkflow}>{workflowSteps}</div>
          <details className={styles.mobileWorkflow}>
            <summary>
              {current.status === 'OPS_APPROVED' ? 'Đã duyệt phương án nhân sự'
                : currentStepIndex >= 0 ? `Bước ${currentStepIndex + 1}/${v2Steps.length} · ${v2Steps[currentStepIndex].title}`
                  : 'Tiến độ chuẩn bị nhân sự'}
            </summary>
            {workflowSteps}
          </details>
          {stageGuide && (
            <div className={styles.stageGuideBanner} role="region" aria-label="Hướng dẫn thao tác bước hiện tại">
              <div className={styles.stageGuideMain}>
                <span className={styles.stageGuideEyebrow}>Thao tác ở bước hiện tại · {stageGuide.actor}</span>
                <p className={styles.stageGuideTitle}>{stageGuide.title}</p>
                <p className={styles.stageGuideText}>{stageGuide.detail}</p>
              </div>
              <div className={styles.stageRoutePill}>
                <span>{stageGuide.actor}</span>
                <span className={styles.stageRouteArrow} aria-hidden="true">→</span>
                <span>{stageGuide.next}</span>
              </div>
            </div>
          )}
        </>
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
          {totalCabins > 0 && (
            <div className={styles.progressTrack} aria-hidden="true">
              <div
                className={`${styles.progressFill} ${availableCabins === totalCabins ? styles.progressFillSuccess : ''}`}
                style={{ width: `${progressPercent(availableCabins, totalCabins)}%` }}
              />
            </div>
          )}
          <span className={styles.summarySub}>
            {state.ship ? `${availableCabins}/${totalCabins} cabin sẵn sàng phục vụ` : 'Cần gán tàu trước khi kiểm tra'}
          </span>
          {state.staff.find(member => member.role === 'SHIP_MANAGER')?.username && <span className={styles.summarySub}>
            Quản lý tàu: {state.staff.find(member => member.role === 'SHIP_MANAGER')?.username}
          </span>}
          {current.workflowVersion === 'V2' && state.ship && <span className={styles.summarySub}>
            {state.ship.modelId ? 'Có mô hình tàu sẵn sàng đang áp dụng' : 'Chưa có mô hình tàu sẵn sàng'}
          </span>}
        </div>

        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Khu vực mở, POS & dịch vụ</span>
          <div className={styles.summaryValueRow}>
            {!placementNotApplicable && <strong className={styles.summaryValue}>
              {activeAreas.length}/{state.areas.length} khu vực mở
            </strong>}
            <Badge
              label={
                placementNotApplicable ? 'Không áp dụng' :
                current.workflowVersion === 'V2' ? (ready ? 'Phương án đáp ứng' : 'Cần kiểm tra phương án') :
                activeAreas.length === 0
                  ? 'Chưa chọn khu vực'
                  : posCoveredCount === activeAreas.length && servicesCoveredCount === state.plannedServices.length
                    ? 'Đủ POS & dịch vụ'
                    : 'Cần hoàn tất POS/dịch vụ'
              }
              tone={
                placementNotApplicable ? 'neutral' :
                (current.workflowVersion === 'V2' ? ready :
                  activeAreas.length > 0 && posCoveredCount === activeAreas.length && servicesCoveredCount === state.plannedServices.length)
                  ? 'success'
                  : 'warning'
              }
            />
          </div>
          {!placementNotApplicable && (activeAreas.length + state.plannedServices.length) > 0 && (
            <div className={styles.progressTrack} aria-hidden="true">
              <div
                className={`${styles.progressFill} ${posCoveredCount === activeAreas.length && servicesCoveredCount === state.plannedServices.length ? styles.progressFillSuccess : styles.progressFillWarn}`}
                style={{ width: `${progressPercent(posCoveredCount + servicesCoveredCount, activeAreas.length + state.plannedServices.length)}%` }}
              />
            </div>
          )}
          {!placementNotApplicable && <span className={styles.summarySub}>
            {posCoveredCount}/{activeAreas.length} khu vực đã gắn POS · {servicesCoveredCount}/{state.plannedServices.length} dịch vụ trên tàu đã bố trí
          </span>}
        </div>

        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Định biên & phân công nhân sự</span>
          <div className={styles.summaryValueRow}>
            {!noStaffingDemand && <strong className={styles.summaryValue}>
              {totalAssigned}/{totalRequired} nhân sự
            </strong>}
            <Badge
              label={
                noStaffingDemand ? (placementNotApplicable ? 'Không cần bố trí nhân sự' : 'Chưa có nhu cầu hoặc ca để phân công') :
                totalRequired === 0 && state.activities.length === 0
                  ? 'Chưa định biên'
                  : missingStaffCount === 0 && missingActivitiesCount === 0
                    ? 'Đủ định biên & ca'
                    : missingStaffCount > 0 && missingActivitiesCount > 0
                      ? `Thiếu ${missingStaffCount} định biên · ${missingActivitiesCount} ca`
                      : missingStaffCount > 0
                        ? `Thiếu ${missingStaffCount} định biên khu vực`
                        : `Thiếu ${missingActivitiesCount} ca hoạt động/tour bờ`
              }
              tone={
                totalRequired === 0 && state.activities.length === 0
                  ? 'neutral'
                  : missingStaffCount === 0 && missingActivitiesCount === 0
                    ? 'success'
                    : 'warning'
              }
            />
          </div>
          {!noStaffingDemand && totalRequired > 0 && (
            <div className={styles.progressTrack} aria-hidden="true">
              <div
                className={`${styles.progressFill} ${missingStaffCount === 0 && missingActivitiesCount === 0 ? styles.progressFillSuccess : styles.progressFillWarn}`}
                style={{ width: `${progressPercent(totalAssigned, totalRequired)}%` }}
              />
            </div>
          )}
          {!noStaffingDemand && <span className={styles.summarySub}>
            {state.activities.length > 0
              ? `${needs.length} vị trí khu vực · ${activitiesCoveredCount}/${state.activities.length} ca hoạt động/tour bờ`
              : `${needs.length} vị trí định biên tại khu vực mở`}
          </span>}
        </div>
      </div>

      {current.shipPlanStale && (
        <Notice title="Phương án tàu đã thay đổi" tone="warning">
          Các phân công cũ không được tính vào nhu cầu hiện tại. Cần trả Quản lý tàu kiểm tra lại trước khi chuyển tiếp.
        </Notice>
      )}

      {hr ? (
        <>
          {staffingAssignmentPanel}
          {!stale && !current.shipPlanStale && activitySection}
          <details className={styles.details}>
            <summary>Xem cấu hình tàu, khu vực mở và dịch vụ</summary>
            <div className={styles.detailsBody}>{shipProgramContent}</div>
          </details>
        </>
      ) : (
        <>
          <Panel title="Tàu và chương trình phục vụ">{shipProgramContent}</Panel>
          {staffingAssignmentPanel}
          {!stale && !current.shipPlanStale && activitySection}
        </>
      )}

      {error && <Notice title="Chưa lưu được thay đổi" tone="error">{error}</Notice>}
      {stale && (
        <Notice title="Yêu cầu đã thay đổi" tone="warning">
          Bản nhập của bạn vẫn ở đây. Kiểm tra dữ liệu mới trước khi lưu lại.
          <Button
            tone="text"
            disabled={details.loading || Boolean(details.error)}
            onClick={() => {
              if (draft && (!ship || draft.areas.some(id => !state.areas.some(area => area.areaId === id))
                || draft.needs.some(need => !state.positionOptions.includes(need.positionCode)))) setDraft(undefined)
              setReturning(false)
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
        <div className={styles.handoffCard} role="region" aria-label="Xác nhận và chuyển bước xét duyệt">
          <div className={styles.handoffCardHeader}>
            <h3 className={styles.handoffCardTitle}>
              {returning ? 'Trả phương án về bộ phận trước' : 'Xác nhận & chuyển bước tiếp theo'}
            </h3>
            {stageGuide && !returning && (
              <div className={styles.stageRoutePill}>
                <span>{stageGuide.actor}</span>
                <span className={styles.stageRouteArrow} aria-hidden="true">→</span>
                <span>{stageGuide.next}</span>
              </div>
            )}
          </div>
          {!returning && (ship || hr) && (
            <ul className={styles.readinessChecklist} aria-label="Điều kiện hoàn tất bước hiện tại">
              {ship && !legacyShip && (
                <>
                  <li className={styles.readinessItem}>
                    <span className={state.ship && state.ship.modelId ? styles.readinessIconOk : styles.readinessIconPending} aria-hidden="true">
                      {state.ship && state.ship.modelId ? '✓' : '•'}
                    </span>
                    <span>{state.ship && state.ship.modelId ? 'Tàu & mô hình 3D sẵn sàng' : 'Chưa có tàu hoặc mô hình 3D sẵn sàng'}</span>
                  </li>
                  <li className={styles.readinessItem}>
                    <span className={!draft && activeAreas.length > 0 ? styles.readinessIconOk : styles.readinessIconPending} aria-hidden="true">
                      {!draft && activeAreas.length > 0 ? '✓' : '•'}
                    </span>
                    <span>{draft ? 'Cần lưu thay đổi ở Bước 1 trước' : `Đã lưu ${activeAreas.length} khu vực mở (${totalRequired} người)`}</span>
                  </li>
                  <li className={styles.readinessItem}>
                    <span className={posCoveredCount === activeAreas.length && activeAreas.length > 0 ? styles.readinessIconOk : styles.readinessIconPending} aria-hidden="true">
                      {posCoveredCount === activeAreas.length && activeAreas.length > 0 ? '✓' : '•'}
                    </span>
                    <span>Gắn máy POS offline: {posCoveredCount}/{activeAreas.length} khu vực</span>
                  </li>
                  {state.plannedServices.length > 0 && (
                    <li className={styles.readinessItem}>
                      <span className={servicesCoveredCount === state.plannedServices.length ? styles.readinessIconOk : styles.readinessIconPending} aria-hidden="true">
                        {servicesCoveredCount === state.plannedServices.length ? '✓' : '•'}
                      </span>
                      <span>Bố trí dịch vụ vào khu vực có POS: {servicesCoveredCount}/{state.plannedServices.length} dịch vụ</span>
                    </li>
                  )}
                </>
              )}
              {hr && (
                <>
                  <li className={styles.readinessItem}>
                    <span className={missingStaffCount === 0 ? styles.readinessIconOk : styles.readinessIconPending} aria-hidden="true">
                      {missingStaffCount === 0 ? '✓' : '•'}
                    </span>
                    <span>
                      {missingStaffCount === 0
                        ? `Đủ định biên khu vực (${totalAssigned}/${totalRequired} nhân sự)`
                        : `Còn thiếu ${missingStaffCount} nhân sự theo định biên khu vực`}
                    </span>
                  </li>
                  {state.activities.length > 0 && (
                    <li className={styles.readinessItem}>
                      <span className={missingActivitiesCount === 0 ? styles.readinessIconOk : styles.readinessIconPending} aria-hidden="true">
                        {missingActivitiesCount === 0 ? '✓' : '•'}
                      </span>
                      <span>
                        {missingActivitiesCount === 0
                          ? `Đủ nhân sự phụ trách ca (${activitiesCoveredCount}/${state.activities.length} ca)`
                          : `Còn thiếu ${missingActivitiesCount} ca hoạt động / tour bờ`}
                      </span>
                    </li>
                  )}
                </>
              )}
            </ul>
          )}
          {Boolean(draft) && (
            <p className={styles.blockerHint}>
              Lưu hoặc hủy thay đổi ở mục &ldquo;Bước 1: Khu vực mở và số người cần&rdquo; trước khi xác nhận phương án tàu.
            </p>
          )}
          {!draft && ship && !legacyShip && !ready && (() => {
            const shipBlockers = [
              !state.ship ? 'nhờ Quản lý lịch trình gán tàu cho chuyến' : null,
              state.ship && !state.ship.modelId ? 'hoàn tất mô hình tàu sẵn sàng' : null,
              posCoveredCount < activeAreas.length ? `gắn máy POS cho ${activeAreas.length - posCoveredCount} khu vực mở còn thiếu` : null,
              servicesCoveredCount < state.plannedServices.length ? `bố trí khu vực/POS cho ${state.plannedServices.length - servicesCoveredCount} dịch vụ trên tàu` : null,
            ].filter(Boolean)
            return (
              <p className={styles.blockerHint}>
                {shipBlockers.length
                  ? `Trước khi xác nhận phương án tàu, cần ${shipBlockers.join(', ')}.`
                  : 'Máy chủ chưa xác nhận phương án sẵn sàng. Kiểm tra cấu hình tàu và khu vực của các hoạt động trong chương trình.'}
              </p>
            )
          })()}
          {hr && missingStaffCount > 0 && (
            <p className={styles.blockerHint}>
              Còn thiếu {missingStaffCount} nhân sự theo định biên khu vực. Hãy phân công đủ người trước khi gửi, hoặc bấm &ldquo;{action.backLabel}&rdquo; để trả Quản lý tàu điều chỉnh khu vực/nhu cầu.
            </p>
          )}
          {hr && missingActivitiesCount > 0 && (
            <p className={styles.blockerHint}>
              Còn {missingActivitiesCount} ca hoạt động trên tàu / tour bờ chưa được phân ca. Hãy phân ca ở mục bên trên trước khi gửi phương án.
            </p>
          )}
          {action.back === 'SHIP_RETURN_ASM' && state.canReturnToAsm === false && (
            <Notice tone="warning" title="Chương trình đang khóa">
              Nhờ Quản lý lịch trình rút hồ sơ đang chờ duyệt hoặc Quản lý vận hành yêu cầu bổ sung kế hoạch để Quản lý dịch vụ chỉnh sửa.
            </Notice>
          )}
          {returning && (
            <>
              {action.back && ['SHIP_RETURN_ASM', 'HR_RETURN_SHIP', 'CRM_RETURN_SHIP'].includes(action.back) && (
                <Notice tone="warning" title="Lưu ý phạm vi ảnh hưởng khi trả phương án">
                  {resetImpactCopy(current, action.back) || 'Trả phương án về sẽ xóa toàn bộ phân bổ nhân sự theo nhu cầu của chuyến này.'}{' '}
                  Nhân sự vẫn giữ tư cách thành viên chuyến và ca hoạt động riêng (nếu có); Quản lý nhân sự sẽ cần phân bổ lại sau khi phương án mới được gửi sang.
                </Notice>
              )}
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
            </>
          )}
          <div className={styles.actions}>
            {action.approve && !returning && (
              <Button
                disabled={
                  disabled
                  || details.loading
                  || Boolean(draft)
                  || current.shipPlanStale
                  || (ship && !ready)
                  || (hr && (missingStaffCount > 0 || missingActivitiesCount > 0))
                }
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
                  if (returning && previous) confirmImpact(previous,
                    () => void mutate(() => staffingApi.transition(current, previous, reason.trim()), true))
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
      {confirmation && (
        <Modal title="Xác nhận thay đổi phương án nhân sự" onClose={() => setConfirmation(undefined)} footer={<>
          <Button tone="secondary" onClick={() => setConfirmation(undefined)}>Quay lại</Button>
          <Button disabled={disabled || confirmation.revision !== current.revision} onClick={() => {
            setConfirmation(undefined)
            confirmation.run()
          }}>Tiếp tục</Button>
        </>}>
          <p>{confirmation.message}</p>
        </Modal>
      )}
    </div>
  )
}
