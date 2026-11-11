import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { useSessionAccess } from '@/shared/auth'
import { businessCopy } from '@/shared/i18n/business-copy'
import { Button, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { preparationApi, type PreparationSection as Section, type PreparationAction } from '../api/preparation-api'
import { PreparationCoordinator } from './PreparationCoordinator'
import { allowedDepartureSections, type DepartureSection } from '../model/preparation'
import styles from './ManagerWorkspace.module.css'

const actions = {
  confirm: 'Xác nhận nhóm hồ sơ',
  return: 'Yêu cầu bổ sung hồ sơ',
} as const

const sectionMeta: Record<string, { title: string; targetSection?: DepartureSection; targetLabel?: string }> = {
  TECHNICAL_NAUTICAL: { title: 'Kỹ thuật hàng hải và tàu', targetSection: 'resources', targetLabel: 'Xem thông tin tàu & quy định' },
  HOTEL_CABIN: { title: 'Khách sạn và cabin', targetSection: 'sales', targetLabel: 'Xem tồn cabin & sức chứa' },
  ENTERTAINMENT_SHORE: { title: 'Hoạt động giải trí và tour bờ', targetSection: 'program', targetLabel: 'Cấu hình chương trình & tour' },
  SAFETY_CREW: { title: 'An toàn và thuyền viên', targetSection: 'staff', targetLabel: 'Quản lý nhân sự trên tàu' },
}

const sectionOrder = ['TECHNICAL_NAUTICAL', 'HOTEL_CABIN', 'ENTERTAINMENT_SHORE', 'SAFETY_CREW']

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

      <div className={styles.prepCardList}>
        {sortedSections.map(section => {
          const meta = sectionMeta[section.sectionCode] ?? { title: section.sectionName || 'Hồ sơ' }
          const missing = section.checkItems.filter(item => item.required && !item.ready)
          const passed = section.checkItems.filter(item => item.ready)
          const allPassed = section.checkItems.length > 0 && missing.length === 0
          const target = meta.targetSection
          const canNavigate = target && onNavigateSection && availableSections.some(([key]) => key === target)
          const canReview = isOps && access.has('CRUISE_PREPARATION_CONFIRM') && ['SUBMITTED', 'CONFIRMED'].includes(section.status)

          return (
            <section key={section.sectionCode} className={styles.prepCard}>
              <div className={styles.prepCardBody}>
                <div className={styles.prepGroupHeading}>
                  <h3 className={styles.prepCardTitle}>{meta.title}</h3>
                  {allPassed&&<span className={styles.prepReady}>Đã đủ điều kiện</span>}
                </div>
                {missing.length>0&&<ul className={styles.prepMissing}>
                  {missing.map(item=><li key={item.itemCode}>{item.evidence || checks[item.itemCode] || 'Cần bổ sung thông tin'}</li>)}
                </ul>}
                {passed.length>0&&<details className={styles.prepEvidenceDetails}>
                  <summary>Xem thông tin kiểm tra</summary>
                  <ul>{passed.map(item=><li key={item.itemCode}>
                    {checks[item.itemCode] ?? 'Điều kiện đã đạt'}{item.evidence&&` · ${item.evidence}`}
                  </li>)}</ul>
                </details>}

                {section.returnReason && (
                  <Notice title="Yêu cầu bổ sung từ Quản lý vận hành" tone="error">
                    {section.returnReason}
                  </Notice>
                )}

                {(!allPassed&&canNavigate||canReview)&&<div className={styles.prepCardActions}>
                  {!allPassed&&canNavigate&&<Button tone="secondary" autoWidth onClick={()=>onNavigateSection(target)}>
                    {meta.targetLabel}
                  </Button>}
                  {canReview&&<>
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
                  </>}
                </div>}
              </div>
            </section>
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
