import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { useSessionAccess } from '@/shared/auth'
import { businessCopy, domainStatus } from '@/shared/i18n/business-copy'
import { Badge, Button, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { preparationApi, type PreparationSection as Section, type PreparationAction } from '../api/preparation-api'
import { PreparationCoordinator } from './PreparationCoordinator'
import { journeyTime, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { allowedDepartureSections, type DepartureSection } from '../model/preparation'
import styles from './ManagerWorkspace.module.css'

const actions = {
  confirm: 'Xác nhận nhóm hồ sơ',
  return: 'Yêu cầu bổ sung hồ sơ',
} as const

const sectionMeta: Record<string, { title: string; index: number; targetSection?: DepartureSection; targetLabel?: string }> = {
  TECHNICAL_NAUTICAL: { title: 'Kỹ thuật hàng hải và tàu', index: 1, targetSection: 'resources', targetLabel: 'Xem thông tin tàu & quy định' },
  HOTEL_CABIN: { title: 'Khách sạn và cabin', index: 2, targetSection: 'sales', targetLabel: 'Xem tồn cabin & sức chứa' },
  ENTERTAINMENT_SHORE: { title: 'Hoạt động giải trí và tour bờ', index: 3, targetSection: 'program', targetLabel: 'Cấu hình chương trình & tour' },
  SAFETY_CREW: { title: 'An toàn và thuyền viên', index: 4, targetSection: 'staff', targetLabel: 'Quản lý nhân sự trên tàu' },
}

const sectionOrder = ['TECHNICAL_NAUTICAL', 'HOTEL_CABIN', 'ENTERTAINMENT_SHORE', 'SAFETY_CREW']

const owners: Record<string, { name: string; tone: 'neutral' | 'info' | 'warning' }> = {
  SHIP_MANAGER: { name: 'Quản lý tàu', tone: 'neutral' },
  CRUISE_MANAGER: { name: 'Quản lý lịch trình', tone: 'info' },
  OPERATIONS_MANAGER: { name: 'Quản lý vận hành', tone: 'warning' },
}

const checks: Record<string, string> = {
  SHIP_ASSIGNED: 'Tàu đã được phân công',
  SHIP_STATUS_ACTIVE: 'Tàu đang hoạt động',
  SHIP_CONFIG: 'Cấu hình boong và cabin',
  CABIN_INVENTORY: 'Kiểm kê Cabin',
  SHORE_EXCURSIONS: 'Hoạt động trên tàu và tour tham quan trên bờ',
  ONBOARD_STAFF_ASSIGNED: 'Phân công nhân sự trên tàu (Onboard Staff)',
}

export function PreparationEvidence({
  cruiseId,
  onChanged,
  onSubmit,
  refreshKey = 0,
  onNavigateSection,
}: {
  cruiseId: string
  onChanged: () => void
  onSubmit?: () => void
  refreshKey?: number
  onNavigateSection?: (section: DepartureSection) => void
}) {
  const access = useSessionAccess()
  const availableSections = allowedDepartureSections(access)
  const allowed = access.has('CRUISE_PREPARATION_READ')
  const manager = access.roles.includes('CRUISE_MANAGER') && !access.roles.includes('OPERATIONS_MANAGER')
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
    useCallback(signal => allowed ? preparationApi.get(cruiseId, signal) : Promise.resolve(null), [cruiseId, allowed])
  )

  const changed = () => {
    setEpoch(n => n + 1)
    onChanged()
  }

  const can = (section: Section, action: PreparationAction) =>
    section.allowedActions.includes(action.toUpperCase()) &&
    (action === 'submit'
      ? query.data?.coordinatorUserId === access.userId && access.roles.includes('CRUISE_MANAGER') && access.has('CRUISE_PREPARATION_SUBMIT')
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
  const sortedSections = [...sections].sort((a, b) => sectionOrder.indexOf(a.sectionCode) - sectionOrder.indexOf(b.sectionCode))
  const pending = sections.filter(s => !['SUBMITTED', 'CONFIRMED'].includes(s.status))
  const notSubmitted = sections.filter(s => ['NOT_STARTED', 'IN_PROGRESS', 'RETURNED'].includes(s.status))
  const awaitingConfirmation = sections.filter(s => s.status === 'SUBMITTED')
  const confirmedCount = sections.filter(s => s.status === 'CONFIRMED').length

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
    <Panel title={businessCopy('preparation.dashboard.title')}>
      {query.data && <PreparationCoordinator key={`${cruiseId}:${query.data.cruiseRevision}`} view={query.data} onChanged={changed} />}
      {query.loading && <Loading label="Đang tải dữ liệu hồ sơ chuẩn bị…" />}
      {query.error && (
        <Notice title="Chưa đọc được hồ sơ chuẩn bị" tone="error">
          <p>{query.error instanceof ApiError && query.error.code ? businessErrorMessage(query.error.code, '') : query.error.message}</p>
          <Button onClick={query.retry}>Tải lại hồ sơ</Button>
        </Notice>
      )}

      {query.data && !query.loading && !query.error && (
        <Notice
          title={
            confirmedCount === sections.length && sections.length > 0
              ? 'Tất cả 4 nhóm hồ sơ đã được Quản lý vận hành xác nhận đạt'
              : notSubmitted.length > 0
              ? 'Hồ sơ đang chuẩn bị hoặc cần bổ sung'
              : 'Hồ sơ đã gửi, chờ Quản lý vận hành kiểm tra'
          }
          tone={confirmedCount === sections.length && sections.length > 0 ? 'success' : notSubmitted.length > 0 ? 'warning' : 'info'}
        >
          {notSubmitted.length > 0 && <p>Còn {notSubmitted.length} nhóm hồ sơ chưa gửi hoặc cần bổ sung dữ liệu.</p>}
          {awaitingConfirmation.length > 0 && <p>{awaitingConfirmation.length} nhóm đã gửi. Quản lý vận hành kiểm tra từng nhóm bên dưới để bấm xác nhận.</p>}
          {confirmedCount === sections.length && sections.length > 0 && <p>Tất cả các nhóm kỹ thuật, cabin, an toàn và tour đã sẵn sàng phục vụ chuyến.</p>}
        </Notice>
      )}

      {manager && onSubmit && pending.length > 0 && (
        <div className={styles.sectionActions} style={{ margin: '16px 0' }}>
          <Button tone="primary" onClick={onSubmit}>
            Kiểm tra và gửi hồ sơ chuyến khởi hành
          </Button>
        </div>
      )}

      <div className={styles.prepCardList}>
        {sortedSections.map(section => {
          const meta = sectionMeta[section.sectionCode] ?? { title: section.sectionName || 'Hồ sơ', index: 0 }
          const owner = owners[section.ownerRole] ?? { name: 'Chưa phân công', tone: 'neutral' }
          const totalChecks = section.checkItems.length
          const passedChecks = section.checkItems.filter(i => i.ready).length
          const allPassed = totalChecks > 0 && section.checkItems.every(i => !i.required || i.ready)
          const isOwnerOps = section.ownerRole === 'OPERATIONS_MANAGER'

          return (
            <div key={section.sectionCode} className={styles.prepCard}>
              <header className={styles.prepCardHeader}>
                <div className={styles.prepCardTitleRow}>
                  <span className={styles.prepCardNum}>{meta.index}</span>
                  <h3 className={styles.prepCardTitle}>{meta.title}</h3>
                </div>
                <div className={styles.prepCardTags}>
                  <Badge label={`Phụ trách: ${owner.name}`} tone={owner.tone} />
                  <Badge
                    label={domainStatus('preparation.section', section.status)}
                    tone={section.status === 'CONFIRMED' ? 'success' : section.status === 'RETURNED' ? 'error' : section.status === 'SUBMITTED' ? 'warning' : 'neutral'}
                  />
                  {totalChecks > 0 && (
                    <Badge
                      label={`${passedChecks}/${totalChecks} tiêu chí đạt`}
                      tone={allPassed ? 'success' : 'warning'}
                    />
                  )}
                </div>
              </header>

              <div className={styles.prepCardBody}>
                {section.checkItems.length === 0 ? (
                  <p className={styles.help}>Quản lý vận hành đối chiếu nội dung hồ sơ đã nộp để xác nhận.</p>
                ) : (
                  <ul className={styles.prepCheckList}>
                    {section.checkItems.map(item => (
                      <li
                        key={item.itemCode}
                        className={`${styles.prepCheckItem} ${item.ready ? styles.prepCheckItemPass : styles.prepCheckItemFail}`}
                      >
                        <span className={`${styles.prepCheckSymbol} ${item.ready ? styles.prepCheckSymbolPass : styles.prepCheckSymbolFail}`}>
                          {item.ready ? '✓' : '✕'}
                        </span>
                        <div className={styles.prepCheckDetails}>
                          <p className={styles.prepCheckName}>{checks[item.itemCode] ?? item.itemCode}</p>
                          {item.evidence && <p className={styles.prepCheckHint}>{item.evidence}</p>}
                          {!item.ready && !item.evidence && (
                            <p className={styles.prepCheckHint}>Hạng mục bắt buộc chưa đạt. Cần hoàn thiện trước khi xác nhận.</p>
                          )}
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

                <footer className={styles.prepCardFooter}>
                  <div className={styles.prepCardMeta}>
                    {section.submittedAt && (
                      <span>Đã nộp: {journeyTime(section.submittedAt, SHIP_TIME_ZONE)} · Giờ Việt Nam</span>
                    )}
                    {section.confirmedAt && section.status === 'CONFIRMED' && (
                      <span style={{ marginLeft: section.submittedAt ? '12px' : 0 }}>
                        Đã xác nhận: {journeyTime(section.confirmedAt, SHIP_TIME_ZONE)}
                        {section.confirmedByUsername ? ` (${section.confirmedByUsername})` : ''}
                      </span>
                    )}
                    {!section.submittedAt && !section.confirmedAt && (
                      <span>Chưa nộp hồ sơ</span>
                    )}
                  </div>

                  <div className={styles.prepCardActions}>
                    {/* Navigation shortcut to fix incomplete items */}
                    {!allPassed && meta.targetSection && onNavigateSection && availableSections.some(([key]) => key === meta.targetSection) && (
                      <Button tone="secondary" onClick={() => onNavigateSection(meta.targetSection!)}>
                        {meta.targetLabel} →
                      </Button>
                    )}

                    {/* Explanatory note for non-owners */}
                    {!allPassed && manager && isOwnerOps && section.sectionCode === 'SAFETY_CREW' && (
                      <span className={styles.prepCardMeta}>
                        Chờ Quản lý vận hành phân công nhân sự trên tàu.
                      </span>
                    )}

                    {/* OPS confirmation actions */}
                    {isOps && access.has('CRUISE_PREPARATION_CONFIRM') && ['SUBMITTED', 'CONFIRMED'].includes(section.status) && (
                      <>
                        {section.status === 'SUBMITTED' && (
                          <Button
                            tone="primary"
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
                            Người nộp hồ sơ không thể tự duyệt. Cần tài khoản QLVH khác.
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </footer>
              </div>
            </div>
          )
        })}
      </div>

      {error && <Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}
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
          onClose={() => { if (!busy) setSelected(null) }}
          footer={
            <>
              <Button tone="secondary" disabled={busy} onClick={() => setSelected(null)}>
                Hủy
              </Button>
              <Button
                tone={selected.action === 'confirm' ? 'primary' : 'danger'}
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
            label={selected.action === 'return' ? 'Nội dung và lý do cần bổ sung' : 'Ghi chú xác nhận (tùy chọn)'}
          >
            <textarea
              id="prep-evidence"
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              required={selected.action !== 'confirm'}
              placeholder={selected.action === 'return' ? 'Nhập chi tiết các hạng mục còn thiếu hoặc cần bổ sung…' : 'Ghi chú xác nhận hồ sơ đạt yêu cầu…'}
            />
          </Field>
        </Modal>
      )}
    </Panel>
  )
}
