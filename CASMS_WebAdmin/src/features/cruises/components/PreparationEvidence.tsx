import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { useSessionAccess } from '@/shared/auth'
import { businessCopy } from '@/shared/i18n/business-copy'
import { Badge, Button, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import {
  preparationApi,
  type PreparationSection as Section,
  type PreparationAction,
  formatOperatingBudget,
} from '../api/preparation-api'
import { PreparationCoordinator } from './PreparationCoordinator'
import { allowedDepartureSections, type DepartureSection } from '../model/preparation'
import styles from './ManagerWorkspace.module.css'

const actions = {
  submit: 'Gửi nhóm hồ sơ này cho Vận hành',
  confirm: 'Xác nhận nhóm hồ sơ',
  return: 'Yêu cầu bổ sung hồ sơ',
} as const

const sectionMeta: Record<
  string,
  { title: string; specialist?: string; targetSection?: DepartureSection; targetLabel?: string }
> = {
  TECHNICAL_NAUTICAL: {
    title: 'Kỹ thuật hàng hải và tàu',
    specialist: 'Quản lý tàu xác nhận khả năng đáp ứng',
    targetSection: 'resources',
    targetLabel: 'Xem thông tin tàu và quy định',
  },
  HOTEL_CABIN: {
    title: 'Khách sạn và cabin',
    specialist: 'Quản lý tàu phụ trách cabin và boong',
    targetSection: 'sales',
    targetLabel: 'Xem cabin và sức chứa',
  },
  ENTERTAINMENT_SHORE: {
    title: 'Hoạt động và tour bờ',
    specialist: 'ASM phụ trách dịch vụ và tour bờ',
    targetSection: 'program',
    targetLabel: 'Xem hoạt động và tour bờ',
  },
  SAFETY_CREW: {
    title: 'An toàn và thuyền viên',
    specialist: 'Nhân sự bố trí người, Vận hành kiểm tra an toàn',
    targetSection: 'staff',
    targetLabel: 'Xem phân công nhân sự',
  },
}

const sectionOrder = ['TECHNICAL_NAUTICAL', 'HOTEL_CABIN', 'ENTERTAINMENT_SHORE', 'SAFETY_CREW']

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
}: {
  cruiseId: string
  onChanged: () => void
  refreshKey?: number
  onNavigateSection?: (section: DepartureSection) => void
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
    section.allowedActions.includes(action.toUpperCase()) &&
    (action === 'submit'
      ? query.data?.coordinatorUserId === access.userId &&
        access.roles.includes('CRUISE_MANAGER') &&
        access.has('CRUISE_PREPARATION_SUBMIT')
      : access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_PREPARATION_CONFIRM'))

  async function execute() {
    if (!selected || lock.current || unknown) return
    const { section, action } = selected
    if (!can(section, action)) return
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
      if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) setUnknown(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const sections = query.data?.sections ?? []
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
      title={businessCopy('preparation.dashboard.title')}
      subtitle="Tổng hợp 4 nhóm hồ sơ kỹ thuật, dịch vụ và an toàn gửi sang bộ phận Vận hành."
    >
      {query.data && (
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

      <div className={styles.prepCardGrid2x2}>
        {sortedSections.map((section, idx) => {
          const meta = sectionMeta[section.sectionCode] ?? { title: section.sectionName || 'Hồ sơ' }
          const missing = section.checkItems.filter(item => item.required && !item.ready)
          const passed = section.checkItems.filter(item => item.ready)
          const allPassed = section.checkItems.length > 0 && missing.length === 0
          const target = meta.targetSection
          const canNavigate = target && onNavigateSection && availableSections.some(([key]) => key === target)
          const canReview =
            isOps && access.has('CRUISE_PREPARATION_CONFIRM') && ['SUBMITTED', 'CONFIRMED'].includes(section.status)
          const canSubmit = can(section, 'submit')

          const statusLabel =
            section.status === 'CONFIRMED'
              ? 'Đã xác nhận'
              : section.status === 'RETURNED'
                ? 'Cần bổ sung'
                : section.status === 'SUBMITTED'
                  ? 'Đã gửi · Chờ Vận hành'
                  : 'Chưa gửi'
          const statusTone =
            section.status === 'CONFIRMED'
              ? 'success'
              : section.status === 'RETURNED'
                ? 'error'
                : section.status === 'SUBMITTED'
                  ? 'warning'
                  : 'neutral'

          return (
            <section key={section.sectionCode} className={styles.prepCard}>
              <header className={styles.prepCardHeader}>
                <div className={styles.prepCardTitleRow}>
                  <span className={styles.prepCardNum}>{idx + 1}</span>
                  <div>
                    <h3 className={styles.prepCardTitle}>{meta.title}</h3>
                    {meta.specialist && <p className={styles.prepCardMeta}>{meta.specialist}</p>}
                  </div>
                </div>
                <div className={styles.prepCardTags}>
                  <Badge label={statusLabel} tone={statusTone} />
                </div>
              </header>

              <div className={styles.prepCardBody}>
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
                  <Notice title="Yêu cầu bổ sung từ Quản lý vận hành" tone="error">
                    {section.returnReason}
                  </Notice>
                )}

                {canSubmit && !query.data?.operatingBudgetVnd && (
                  <p className={styles.prepCardMeta}>Lưu ngân sách ở phần Tổng quan trước khi gửi hồ sơ nhóm.</p>
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
                          disabled={busy || unknown || !query.data?.operatingBudgetVnd}
                          onClick={() => {
                            setSelected({ section, action: 'submit' })
                            setText('')
                            setError('')
                          }}
                        >
                          Gửi nhóm hồ sơ này cho Vận hành
                        </Button>
                      )}
                      {canReview && (
                        <>
                          {section.status === 'SUBMITTED' && (
                            <Button
                              tone="primary"
                              size="compact"
                              autoWidth
                              disabled={busy || unknown || !can(section, 'confirm') || !allPassed}
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
                          {section.submittedByUserId === access.userId && (
                            <span className={styles.prepCardMeta}>
                              Người nộp hồ sơ không thể tự duyệt. Một nhân viên Vận hành khác cần xét duyệt.
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

      {error && (
        <Notice title="Không thể hoàn tất thao tác" tone="error">
          {error}
        </Notice>
      )}
      {unknown && (
        <Notice title="Hệ thống chưa xác nhận được kết quả">
          <p>Đối chiếu lại 4 nhóm hồ sơ trước khi tiếp tục. Hạng mục đã gửi sẽ không bị gửi lặp.</p>
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
                tone={selected.action === 'return' ? 'danger' : 'primary'}
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
                : selected.action === 'return'
                  ? 'Nội dung và lý do cần bổ sung'
                  : 'Ghi chú xác nhận (tùy chọn)'
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
