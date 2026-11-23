import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { useSessionAccess } from '@/shared/auth'
import { businessCopy } from '@/shared/i18n/business-copy'
import { Badge, Button, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import {
  preparationApi,
  preparationActionAllowed,
  preparationApprovalLabels,
  type PreparationSection as Section,
  type PreparationAction,
  formatOperatingBudget,
} from '../api/preparation-api'
import { PreparationCoordinator } from './PreparationCoordinator'
import { allowedDepartureSections, type DepartureSection } from '../model/preparation'
import { operationsStaffRole } from '../model/operations-workflow'
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
    title: 'Khách sạn và cabin',
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
    title: 'An toàn và thuyền viên',
    specialist: 'Quản lý nhân sự xếp người · Quản lý vận hành xác nhận trước xuất bến (không chặn mở bán)',
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
  SHIP_STATUS_ACTIVE: 'Tàu đang hoạt động',
  SHIP_CONFIG: 'Cấu hình boong và cabin',
  CABIN_INVENTORY: 'Kiểm kê Cabin',
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
      ? access.has('CRUISE_PREPARATION_SUBMIT') &&
        (section.submitterRole === 'CRUISE_MANAGER'
          ? query.data?.coordinatorUserId === access.userId && access.roles.includes('CRUISE_MANAGER')
          : access.roles.includes(section.submitterRole))
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
  const confirmedCount = sortedSections.filter(s => s.status === 'CONFIRMED').length

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
      title={sectionCode ? 'Hồ sơ kỹ thuật của chuyến' : businessCopy('preparation.dashboard.title')}
      subtitle={sectionCode ? 'Quản lý tàu được phân công nộp hồ sơ kỹ thuật cho Quản lý vận hành xét duyệt.' : 'Mỗi nhóm có người nộp riêng. Dữ liệu đủ điều kiện chưa có nghĩa hồ sơ đã được nộp hoặc xét duyệt.'}
    >
      {query.data && !sectionCode && (
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
            <span className={styles.prepSummaryLabel}>Tiến độ xác nhận 4 nhóm hồ sơ</span>
            <div className={styles.prepSummaryProgressRow}>
              <strong className={styles.prepSummaryValue}>
                {confirmedCount} / {sortedSections.length || 4} nhóm đã xác nhận
              </strong>
              <Badge
                label={confirmedCount === 4 ? 'Đủ 4/4 nhóm' : `Còn ${Math.max(0, 4 - confirmedCount)} nhóm`}
                tone={confirmedCount === 4 ? 'success' : 'warning'}
              />
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
              <div style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: 'var(--brand-navy)' }}>
                  {stage === 'plan'
                    ? '1. Hồ sơ gửi kèm kế hoạch chuyến (Quản lý lịch trình nộp)'
                    : '2. Hồ sơ xác nhận trước xuất bến (không chặn gửi kế hoạch hay mở bán)'}
                </h3>
                <p className={styles.prepCardMeta} style={{ margin: 0 }}>
                  {stage === 'plan'
                    ? 'Hai nhóm này được gửi tự động khi Quản lý lịch trình nộp hồ sơ chuyến cho Quản lý vận hành.'
                    : 'Hai nhóm này do Quản lý tàu của chuyến và Quản lý vận hành xác nhận ở giai đoạn chuẩn bị xuất bến.'}
                </p>
              </div>
            )}
            <div className={sectionCode ? undefined : styles.prepCardGrid2x2}>
              {groupSections.map(section => {
          const meta = sectionMeta[section.sectionCode] ?? { title: section.sectionName || 'Hồ sơ' }
          const missing = section.missingRequiredCheckCodes.map(itemCode =>
            section.checkItems.find(item => item.itemCode === itemCode) ?? { itemCode, evidence: null })
          const passed = section.checkItems.filter(item => item.ready)
          const allPassed = section.dataReadiness === 'READY'
          const target = meta.targetSection
          const canNavigate = target && onNavigateSection && availableSections.some(([key]) => key === target)
          const canReview =
            isOps && access.has('CRUISE_PREPARATION_CONFIRM') && ['SUBMITTED', 'CONFIRMED'].includes(section.status)
          const canSubmit = can(section, 'submit')

          const statusTone = section.approvalStatus === 'CONFIRMED' ? 'success'
            : section.approvalStatus === 'REJECTED' ? 'error'
              : ['RETURNED', 'PENDING', 'STALE'].includes(section.approvalStatus) ? 'warning' : 'neutral'
          const ownerLabel = operationsStaffRole(section.submitterRole)
          const waitingToSubmit = ['NOT_STARTED', 'IN_PROGRESS', 'RETURNED', 'REJECTED', 'STALE'].includes(section.status)
          const blockMessages: Record<string, string> = {
            SUBMIT_PERMISSION_REQUIRED: 'Tài khoản chưa có quyền nộp hồ sơ. Liên hệ người quản trị để kiểm tra quyền.',
            SECTION_SUBMITTER_ROLE_REQUIRED: `${ownerLabel} phụ trách nộp nhóm này. Bạn đang xem hồ sơ.`,
            ASSIGNED_SHIP_MANAGER_REQUIRED: 'Chỉ Quản lý tàu được phân công đang hoạt động cho chuyến này mới có thể nộp hồ sơ kỹ thuật.',
            PLAN_RECEIPT_REQUIRED: 'Quản lý lịch trình cần gửi Cruise Plan trước. Sau khi tiếp nhận, Quản lý vận hành mới nộp nhóm An toàn.',
            PREPARATION_COORDINATOR_REQUIRED: 'Chỉ Quản lý lịch trình được giao điều phối chuyến này mới có thể nộp nhóm hồ sơ.',
          }
          const submissionHint = !canSubmit && waitingToSubmit && section.submissionBlockReason && blockMessages[section.submissionBlockReason]
            ? blockMessages[section.submissionBlockReason]
            : !canSubmit && waitingToSubmit
            ? !access.roles.includes(section.submitterRole)
              ? `Bạn đang xem hồ sơ. ${ownerLabel} phụ trách nộp nhóm này.`
              : !access.has('CRUISE_PREPARATION_SUBMIT')
                ? 'Tài khoản của bạn chưa có quyền nộp hồ sơ. Liên hệ người quản trị để kiểm tra quyền.'
                : section.submitterRole === 'CRUISE_MANAGER' && query.data?.coordinatorUserId !== access.userId
                  ? 'Chỉ Quản lý lịch trình được giao điều phối chuyến này mới có thể nộp nhóm hồ sơ.'
                  : section.submitterRole === 'SHIP_MANAGER'
                    ? 'Chưa được phép nộp. Kiểm tra tài khoản có được phân công Quản lý tàu đang hoạt động cho chuyến này.'
                    : section.submitterRole === 'OPERATIONS_MANAGER'
                      ? 'Chưa được phép nộp. Kiểm tra hồ sơ Cruise Plan đã được chuyển đến Quản lý vận hành và tải lại hồ sơ.'
                      : 'Chưa được phép nộp nhóm hồ sơ. Tải lại để kiểm tra quyền và trạng thái mới nhất.'
            : null
          const next = section.status === 'RETURNED' || section.status === 'REJECTED'
            ? `${ownerLabel} rà soát phản hồi rồi bổ sung hồ sơ.`
            : section.status === 'STALE'
              ? `${ownerLabel} đối chiếu thay đổi của chuyến trước khi gửi lại.`
              : section.approvalStatus === 'PENDING'
                ? 'Tiếp theo: Quản lý vận hành xét duyệt hồ sơ.'
                : section.submissionStatus === 'NOT_SUBMITTED' && section.approvalStatus !== 'CONFIRMED'
                  ? `Tiếp theo: ${ownerLabel} chuẩn bị và nộp hồ sơ.` : null

          return (
            <section key={section.sectionCode} className={styles.prepCard}>
              <header className={styles.prepCardHeader}>
                <div className={styles.prepCardTitleRow}>
                  <div>
                    <h3 className={styles.prepCardTitle}>{meta.title}</h3>
                    {meta.specialist && <p className={styles.prepCardMeta}>{meta.specialist}</p>}
                  </div>
                </div>
                <div className={styles.prepCardTags}>
                  <Badge label={`Dữ liệu: ${allPassed ? 'Đủ điều kiện' : 'Còn thiếu'}`} tone={allPassed ? 'success' : 'warning'} />
                  <Badge label={section.submissionStatus === 'SUBMITTED' ? 'Đã nộp hồ sơ' : 'Chưa nộp hồ sơ'} />
                  <Badge label={`Xét duyệt: ${preparationApprovalLabels[section.approvalStatus]}`} tone={statusTone} />
                </div>
              </header>

              <div className={styles.prepCardBody}>
                <p className={styles.prepCardMeta}>Người nộp hồ sơ: {ownerLabel}.</p>
                {next && <p className={styles.prepCardMeta}>{next}</p>}
                {submissionHint && <p className={styles.prepCardMeta}>{submissionHint}</p>}
                {section.submittedRevision !== null ? <p className={styles.prepCardMeta}>Phiên bản đã nộp {section.submittedRevision}</p>
                  : (section.submissionStatus === 'SUBMITTED' || section.approvalStatus !== 'NOT_REVIEWED') &&
                    <p className={styles.prepCardMeta}>Hồ sơ lịch sử chưa có bằng chứng về phiên bản đã nộp.</p>}
                {missing.length > 0 && (
                  <ul className={styles.prepCheckList} aria-label="Điều kiện còn thiếu">
                    {missing.map(item => (
                      <li key={item.itemCode} className={styles.prepCheckItem}>
                        <CheckStateSvg pass={false} />
                        <div className={styles.prepCheckDetails}>
                          <p className={styles.prepCheckName}>
                            {checks[item.itemCode] || 'Cần bổ sung thông tin'}
                          </p>
                          {item.evidence && <p className={styles.prepCheckHint}>{item.evidence}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {passed.length > 0 && (
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
                  </ul>
                )}

                {section.returnReason && (
                  <Notice title="Phản hồi của Quản lý vận hành" tone="error">
                    {section.returnReason}
                  </Notice>
                )}

                {((!allPassed && canNavigate) || canReview || canSubmit) && (
                  <div className={styles.prepCardFooter}>
                    <div className={styles.prepCardActions}>
                      {!allPassed && canNavigate && (
                        <Button tone="secondary" size="compact" autoWidth onClick={() => onNavigateSection(target)}>
                          {meta.targetLabel}
                        </Button>
                      )}
                      {canSubmit && (
                        <Button
                          size="compact"
                          autoWidth
                          disabled={busy || unknown}
                          onClick={() => {
                            setSelected({ section, action: 'submit' })
                            setText('')
                            setError('')
                          }}
                        >
                          {actions.submit}
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

      {query.data && !sectionCode && access.roles.includes('CRUISE_MANAGER') && onNavigateSection && (
        <Notice title="Hồ sơ Cruise Plan còn có điều kiện riêng">
          <p>Kiểm tra gói, phiên bản giá và các mục cần hoàn thiện ở Tổng quan trước khi nộp hồ sơ tour cho Quản lý vận hành.</p>
          <Button tone="secondary" autoWidth onClick={() => onNavigateSection('overview')}>
            Xem gói giá và điều kiện gửi
          </Button>
        </Notice>
      )}

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
