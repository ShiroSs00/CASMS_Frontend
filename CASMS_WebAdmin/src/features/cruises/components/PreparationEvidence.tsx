import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { useSessionAccess } from '@/shared/auth'
import { businessCopy } from '@/shared/i18n/business-copy'
import { Badge, Button, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import {
  preparationApi,
  preparationActionAllowed,
  type PreparationSection as Section,
  type PreparationAction,
  formatOperatingBudget,
} from '../api/preparation-api'
import { PreparationCoordinator } from './PreparationCoordinator'
import { allowedDepartureSections, type DepartureSection } from '../model/preparation'
import { operationsStaffRole } from '../model/operations-workflow'
import { preparationProgress, preparationSubmissionReason } from '../model/preparation-presentation'
import { staffingApi, staffingStatusLabel } from '../staffing/staffing-api'
import styles from './ManagerWorkspace.module.css'

const actions = {
  submit: 'Gửi nhóm hồ sơ xét duyệt',
  confirm: 'Xác nhận nhóm hồ sơ',
  return: 'Yêu cầu bổ sung hồ sơ',
  reject: 'Từ chối nhóm hồ sơ',
} as const

const sectionMeta: Record<
  string,
  { title: string; specialist?: string; targetSection?: DepartureSection; targetLabel?: string; stage: 'plan' | 'departure' }
> = {
  TECHNICAL_NAUTICAL: {
    title: 'Kỹ thuật hàng hải và tàu',
    specialist: 'Quản lý tàu được phân công cho chuyến gửi xác nhận trước xuất bến (không chặn mở bán)',
    targetSection: 'resources',
    targetLabel: 'Xem thông tin tàu và quy định',
    stage: 'departure',
  },
  HOTEL_CABIN: {
    title: 'Cabin phục vụ khách',
    specialist: 'Quản lý lịch trình gửi kèm hồ sơ kế hoạch chuyến',
    targetSection: 'sales',
    targetLabel: 'Xem cabin và sức chứa',
    stage: 'plan',
  },
  ENTERTAINMENT_SHORE: {
    title: 'Hoạt động và tour bờ',
    specialist: 'Quản lý lịch trình gửi kèm hồ sơ kế hoạch chuyến',
    targetSection: 'program',
    targetLabel: 'Xem hoạt động và tour bờ',
    stage: 'plan',
  },
  SAFETY_CREW: {
    title: 'Nhân sự phục vụ trên tàu',
    specialist: 'Quản lý tàu xác định nhu cầu → Nhân sự phân công → Quản lý tàu xác nhận → Quản lý lịch trình rà soát → Quản lý vận hành phê duyệt. Đây là điều kiện trước xuất bến.',
    targetSection: 'staff',
    targetLabel: 'Xem phân công nhân sự',
    stage: 'departure',
  },
}

const planSectionCodes = ['HOTEL_CABIN', 'ENTERTAINMENT_SHORE'] as const
const departureSectionCodes = ['TECHNICAL_NAUTICAL', 'SAFETY_CREW'] as const
const sectionOrder: readonly string[] = [...planSectionCodes, ...departureSectionCodes]

const checks: Record<string, string> = {
  SHIP_ASSIGNED: 'Tàu đã được phân công',
  SHIP_STATUS_ACTIVE: 'Tình trạng hoạt động của tàu',
  SHIP_CONFIG: 'Cấu hình boong và cabin',
  CABIN_INVENTORY: 'Cabin khả dụng trên tàu',
  SHORE_EXCURSIONS: 'Hoạt động trên tàu và tour tham quan trên bờ',
  ONBOARD_STAFF_ASSIGNED: 'Phân công nhân sự trên tàu',
}

function CheckStateSvg({ pass }: { pass: boolean }) {
  if (pass) {
    return (
      <svg className={styles.prepCheckSvgPass} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.25 8.25l1.8 1.8 3.7-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.prepCheckSvgWarn} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function PreparationEvidence({
  cruiseId,
  onChanged,
  refreshKey = 0,
  onNavigateSection,
  sectionCode,
}: {
  cruiseId: string
  onChanged: () => void
  refreshKey?: number
  onNavigateSection?: (section: DepartureSection) => void
  sectionCode?: string
}) {
  const access = useSessionAccess()
  const availableSections = allowedDepartureSections(access)
  const allowed = access.has('CRUISE_PREPARATION_READ')
  const isOps = access.roles.includes('OPERATIONS_MANAGER')
  const readStaffing = allowed && access.roles.includes('CRUISE_MANAGER') && !sectionCode
  const staffing = useReadQuery(`dossier-staffing:${access.userId}:${cruiseId}:${refreshKey}:${readStaffing}`,
    useCallback(signal => readStaffing ? staffingApi.preparation(cruiseId, signal) : Promise.resolve(null), [readStaffing, cruiseId]))

  const [epoch, setEpoch] = useState(0)
  const [selected, setSelected] = useState<{ section: Section; action: keyof typeof actions } | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const lock = useRef(false)

  const query = useReadQuery(
    `prep-evidence:${access.userId}:${access.status}:${cruiseId}:${epoch}:${allowed}:${refreshKey}`,
    useCallback(signal => (allowed ? preparationApi.get(cruiseId, signal) : Promise.resolve(null)), [cruiseId, allowed]),
  )

  const changed = () => {
    setEpoch(n => n + 1)
    onChanged()
  }

  const can = (section: Section, action: PreparationAction) =>
    preparationActionAllowed(section, action, access.userId) &&
    (action === 'submit'
      ? access.has('CRUISE_PREPARATION_SUBMIT')
      : access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_PREPARATION_CONFIRM'))

  async function execute() {
    if (!selected || lock.current || unknown) return
    const { section, action } = selected
    const latest = query.data?.sections.find(item => item.sectionCode === section.sectionCode)
    if (!latest || latest.revision !== section.revision || !can(latest, action)) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await preparationApi.action(cruiseId, section, action, text)
      setSelected(null)
      setEpoch(n => n + 1)
      onChanged()
    } catch (e) {
      setError(businessErrorMessage(e instanceof ApiError ? e.code : undefined, ''))
      if (!(e instanceof ApiError) || e.status === 0 || e.status === 409 || e.status >= 500) setUnknown(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const sections = (query.data?.sections ?? []).filter(section => !sectionCode || section.sectionCode === sectionCode)
  const sortedSections = [...sections].sort(
    (a, b) => sectionOrder.indexOf(a.sectionCode) - sectionOrder.indexOf(b.sectionCode),
  )
  const coordinatorView = access.roles.includes('CRUISE_MANAGER') && !isOps
  const planGroups = sortedSections.filter(s => planSectionCodes.some(code => code === s.sectionCode))
  const departureGroups = sortedSections.filter(s => departureSectionCodes.some(code => code === s.sectionCode))

  async function reconcile() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await preparationApi.get(cruiseId)
      setUnknown(false)
      setSelected(null)
      setEpoch(n => n + 1)
      onChanged()
    } catch (e) {
      setError(businessErrorMessage(e instanceof ApiError ? e.code : undefined, ''))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (!allowed) return null

  return (
    <Panel
      className={coordinatorView ? styles.coordinatorEvidence : undefined}
      title={sectionCode ? 'Hồ sơ kỹ thuật của chuyến' : coordinatorView ? undefined : businessCopy('preparation.dashboard.title')}
    >
      {query.data && !sectionCode && !coordinatorView && (
        <div className={styles.prepSummaryStrip}>
          <div className={styles.prepSummaryMetric}>
            <span className={styles.prepSummaryLabel}>Điều phối phụ trách</span>
            <PreparationCoordinator
              key={`${cruiseId}:${query.data.cruiseRevision}`}
              view={query.data}
              onChanged={changed}
            />
          </div>

          <div className={styles.prepSummaryMetric}>
            <span className={styles.prepSummaryLabel}>Ngân sách vận hành dự kiến</span>
            <strong className={styles.prepSummaryValue}>
              {query.data.operatingBudgetVnd
                ? formatOperatingBudget(query.data.operatingBudgetVnd)
                : 'Chưa thiết lập ngân sách'}
            </strong>
          </div>

          <div className={styles.prepSummaryMetric}>
            <span className={styles.prepSummaryLabel}>Theo từng giai đoạn</span>
            <div className={styles.prepSummaryProgressRow}>
              <span>Hồ sơ chuyến: {planGroups.filter(s => s.submissionStatus === 'SUBMITTED').length}/{planGroups.length} nhóm đã gửi</span>
              <span>Trước xuất bến: {departureGroups.filter(s => s.approvalStatus === 'CONFIRMED').length}/{departureGroups.length} nhóm đã xác nhận</span>
            </div>
          </div>
        </div>
      )}

      {query.loading && <Loading label="Đang tải dữ liệu hồ sơ chuẩn bị…" />}
      {query.error && (
        <Notice title="Chưa đọc được hồ sơ chuẩn bị" tone="error">
          <p>
            {query.error instanceof ApiError && query.error.code
              ? businessErrorMessage(query.error.code, '')
              : query.error.message}
          </p>
          <Button onClick={query.retry}>Tải lại hồ sơ</Button>
        </Notice>
      )}

      {(sectionCode ? (['all'] as const) : (['plan', 'departure'] as const)).map(stage => {
        const groupSections = stage === 'all'
          ? sortedSections
          : sortedSections.filter(s => (sectionMeta[s.sectionCode]?.stage ?? 'departure') === stage)
        if (!groupSections.length) return null
        return (
          <div key={stage} style={{ marginTop: stage === 'departure' ? '20px' : '0' }}>
            {stage !== 'all' && (
              <div className={styles.dossierGroupHeading}>
                <h3>
                  {stage === 'plan'
                    ? 'Hồ sơ kế hoạch chuyến'
                    : 'Xác nhận trước xuất bến'}
                </h3>
                {coordinatorView && <p className={styles.prepStageNote}>{stage === 'plan' ? 'Nội dung đưa vào kế hoạch gửi Quản lý vận hành.' : 'Theo dõi xác nhận tàu và phương án nhân sự của chuyến.'}</p>}
              </div>
            )}
            <div className={sectionCode ? undefined : styles.prepCardGrid2x2}>
              {groupSections.map(section => {
          const meta = sectionMeta[section.sectionCode] ?? { title: section.sectionName || 'Hồ sơ' }
          const missing = section.missingRequiredCheckCodes.map(itemCode =>
            section.checkItems.find(item => item.itemCode === itemCode) ?? { itemCode, evidence: null })
          const passed = section.checkItems.filter(item => item.ready)
          const allPassed = section.dataReadiness === 'READY'
          const target = coordinatorView && section.sectionCode === 'HOTEL_CABIN' ? 'resources' : meta.targetSection
          const canNavigate = target && onNavigateSection && availableSections.some(([key]) => key === target)
          const canReview =
            isOps && access.has('CRUISE_PREPARATION_CONFIRM') && ['SUBMITTED', 'CONFIRMED'].includes(section.status)
          const canSubmit = can(section, 'submit')
          const individualSubmission = canSubmit && !(coordinatorView && !sectionCode && stage === 'plan') &&
            !(coordinatorView && section.sectionCode === 'SAFETY_CREW' && !allPassed)

          const ownerLabel = section.submitterRole === 'CRUISE_MANAGER' && query.data?.coordinatorUserId === access.userId ? 'Bạn · Điều phối chuyến' : operationsStaffRole(section.submitterRole)
          const progress = preparationProgress(section)
          const eligibility = preparationSubmissionReason(section)

          return (
            <section key={section.sectionCode} className={styles.prepCard}>
              <header className={styles.prepCardHeader}>
                <div className={styles.prepCardTitleRow}>
                  <div>
                    <h3 className={styles.prepCardTitle}>{meta.title}</h3>
                  </div>
                </div>
                <div className={styles.prepCardTags}>
                  {coordinatorView ? !['NOT_STARTED','IN_PROGRESS'].includes(section.status) && <span className={styles.dossierWorkflowState}>{progress.label}</span> : <Badge label={progress.label} tone={progress.tone} />}
                </div>
              </header>

              <div className={styles.prepCardBody}>
                {coordinatorView && <dl className={styles.dossierContentFacts}>
                  {section.checkItems.map(item => <div key={item.itemCode}>
                    <dt>{({CABIN_INVENTORY:'Cabin trên tàu',SHORE_EXCURSIONS:'Chương trình đã chuẩn bị',SHIP_ASSIGNED:'Tàu được phân công',SHIP_STATUS_ACTIVE:'Tình trạng tàu',SHIP_CONFIG:'Boong và cabin',ONBOARD_STAFF_ASSIGNED:'Nhân sự trên chuyến'} as Record<string,string>)[item.itemCode] ?? checks[item.itemCode] ?? 'Thông tin ghi nhận'}</dt>
                    <dd>{item.evidence?.replaceAll('Hoạt động onboard', 'Hoạt động trên tàu') || 'Chưa có dữ liệu để đối chiếu'}</dd>
                  </div>)}
                </dl>}
                {!coordinatorView && <dl className={styles.dossierFacts}>
                  {!coordinatorView && <div><dt>Dữ liệu kiểm tra</dt><dd>{allPassed ? 'Đã đủ dữ liệu' : missing.length ? `Còn ${missing.length} điều kiện chưa đạt` : 'Chưa xác minh đủ dữ liệu'}</dd></div>}
                  <div><dt>Nộp hồ sơ</dt><dd>{ownerLabel}</dd></div>
                  <div><dt>Xét duyệt</dt><dd>Quản lý vận hành</dd></div>
                </dl>}
                {section.sectionCode === 'SAFETY_CREW' && readStaffing && <p className={styles.dossierRouting}><strong>Tiến độ phương án:</strong> {staffing.loading ? 'Đang xác minh…' : staffing.error ? 'Chưa tải được tiến độ nhân sự' : staffing.data?.request ? staffingStatusLabel(staffing.data.request) : 'Chưa bắt đầu phối hợp'}{staffing.error && <Button tone="text" size="compact" onClick={staffing.retry}>Tải lại tiến độ</Button>}</p>}
                {eligibility && (!coordinatorView || section.submissionBlockReason !== 'SECTION_SUBMITTER_ROLE_REQUIRED') && <p className={styles.dossierRouting}>{eligibility}</p>}
                {!coordinatorView && missing.length > 0 && (
                  <ul className={styles.prepCheckList} aria-label="Điều kiện còn thiếu">
                    {missing.map(item => (
                      <li key={item.itemCode} className={styles.prepCheckItem}>
                        <CheckStateSvg pass={false} />
                        <div className={styles.prepCheckDetails}>
                          <p className={styles.prepCheckName}>
                            {checks[item.itemCode] || 'Cần bổ sung thông tin'}
                          </p>
                          {item.evidence && <p className={styles.prepCheckHint}>{item.evidence}</p>}
                          {item.itemCode === 'SHORE_EXCURSIONS' && <p className={styles.prepCheckHint}>Quản lý dịch vụ bổ sung chương trình hoạt động hoặc tour bờ.</p>}
                          {['SHIP_ASSIGNED', 'SHIP_STATUS_ACTIVE', 'SHIP_CONFIG', 'CABIN_INVENTORY'].includes(item.itemCode) && <p className={styles.prepCheckHint}>Đối chiếu với Quản lý tàu tại mục Tàu và quy định.</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {!coordinatorView && passed.length > 0 && <details className={styles.dossierChecks}><summary>{passed.length} điều kiện đã đạt</summary>
                  <ul className={styles.prepCheckList} aria-label="Thông tin kiểm tra đã đạt">
                    {passed.map(item => (
                      <li key={item.itemCode} className={styles.prepCheckItem}>
                        <CheckStateSvg pass />
                        <div className={styles.prepCheckDetails}>
                          <p className={styles.prepCheckName}>{checks[item.itemCode] ?? 'Điều kiện đã đạt'}</p>
                          {item.evidence && <p className={styles.prepCheckHint}>{item.evidence}</p>}
                        </div>
                      </li>
                    ))}
                  </ul></details>}

                {section.returnReason && (
                  <Notice title="Phản hồi của Quản lý vận hành" tone="error">
                    {section.returnReason}
                  </Notice>
                )}

                {(canNavigate || canReview || individualSubmission) && (
                  <div className={styles.prepCardFooter}>
                    <div className={styles.prepCardActions}>
                      {canNavigate && (
                        <Button tone="secondary" size="compact" autoWidth onClick={() => onNavigateSection(target)}>
                          {coordinatorView && section.sectionCode === 'HOTEL_CABIN' ? 'Xem tàu và cabin' : meta.targetLabel}
                        </Button>
                      )}
                      {individualSubmission && (
                        <Button
                          size="compact"
                          tone={coordinatorView ? 'secondary' : 'primary'}
                          autoWidth
                          disabled={busy || unknown}
                          onClick={() => {
                            setSelected({ section, action: 'submit' })
                            setText('')
                            setError('')
                          }}
                        >
                          {section.sectionCode === 'SAFETY_CREW' ? 'Chuyển hồ sơ nhân sự để duyệt' : actions.submit}
                        </Button>
                      )}
                      {canReview && (
                        <>
                          {can(section, 'confirm') && (
                            <Button
                              tone="primary"
                              size="compact"
                              autoWidth
                              disabled={busy || unknown}
                              onClick={() => {
                                setSelected({ section, action: 'confirm' })
                                setText('')
                                setError('')
                              }}
                            >
                              Xác nhận nhóm
                            </Button>
                          )}
                          {can(section, 'return') && (
                            <Button
                              tone="secondary"
                              size="compact"
                              autoWidth
                              disabled={busy || unknown}
                              onClick={() => {
                                setSelected({ section, action: 'return' })
                                setText('')
                                setError('')
                              }}
                            >
                              Yêu cầu bổ sung
                            </Button>
                          )}
                          {can(section, 'reject') && (
                            <Button tone="text" size="compact" autoWidth disabled={busy || unknown} onClick={() => {
                              setSelected({ section, action: 'reject' })
                              setText('')
                              setError('')
                            }}>Từ chối</Button>
                          )}
                          {section.submittedByUserId === access.userId && (
                            <span className={styles.prepCardMeta}>
                              Người nộp hồ sơ không thể tự duyệt. Cần một Quản lý vận hành khác xét duyệt.
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )
        })}
            </div>
          </div>
        )
      })}

      {error && (
        <Notice title="Không thể hoàn tất thao tác" tone="error">
          {error}
        </Notice>
      )}
      {unknown && (
        <Notice title="Hệ thống chưa xác nhận được kết quả">
          <p>Tải lại hồ sơ để kiểm tra phiên bản mới nhất trước khi tiếp tục.</p>
          <Button disabled={busy} onClick={() => void reconcile()}>
            Đối chiếu hồ sơ
          </Button>
        </Notice>
      )}

      {selected && (
        <Modal
          title={actions[selected.action]}
          onClose={() => {
            if (!busy) setSelected(null)
          }}
          footer={
            <>
              <Button tone="secondary" disabled={busy} onClick={() => setSelected(null)}>
                Hủy
              </Button>
              <Button
                tone={selected.action === 'return' || selected.action === 'reject' ? 'danger' : 'primary'}
                disabled={busy || unknown || (selected.action !== 'confirm' && !text.trim())}
                onClick={() => void execute()}
              >
                {busy ? 'Đang lưu…' : actions[selected.action]}
              </Button>
            </>
          }
        >
          <p>
            <strong>{sectionMeta[selected.section.sectionCode]?.title ?? selected.section.sectionName}</strong>
          </p>
          <Field
            htmlFor="prep-evidence"
            label={
              selected.action === 'submit'
                ? 'Nội dung đã chuẩn bị'
                : selected.action === 'confirm'
                  ? 'Ghi chú xác nhận (tùy chọn)'
                  : 'Lý do cần bổ sung hoặc từ chối'
            }
          >
            <textarea
              id="prep-evidence"
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              required={selected.action !== 'confirm'}
            />
          </Field>
        </Modal>
      )}
    </Panel>
  )
}
