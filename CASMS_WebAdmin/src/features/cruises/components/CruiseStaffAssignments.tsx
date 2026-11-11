import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { journeyTime } from '@/shared/lib/journey-time'
import { Badge, Button, DataTable, Empty, Field, Loading, Notice, Panel, UnsavedForms, useFormChanges } from '@/shared/ui'
import { cruiseStaffApi } from '../api/cruise-staff-api'
import { operationsStaffRole, operationsStaffStatus } from '../model/operations-workflow'
import { DepartureCommand } from './DepartureCommand'
import styles from './CruiseStaffAssignments.module.css'

function StaffAssignmentsWorkspace({ cruiseId, onChanged }: { cruiseId: string; onChanged?: () => void }) {
  const access = useSessionAccess()
  const canRead = access.canDo('CRUISE_STAFF_READ')
  const canAssign = access.canDo('CRUISE_STAFF_ASSIGN')
  const canRemove = access.canDo('CRUISE_STAFF_REMOVE')

  const list = useReadQuery(
    `cruise-staff:${cruiseId}:${canRead}`,
    useCallback(signal => (canRead ? cruiseStaffApi.list(cruiseId, signal) : Promise.resolve([])), [cruiseId, canRead])
  )
  const options = useReadQuery(
    `cruise-staff-options:${cruiseId}:${canAssign}`,
    useCallback(signal => (canAssign ? cruiseStaffApi.options(cruiseId, signal) : Promise.resolve(null)), [cruiseId, canAssign])
  )

  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)

  const assignedIds = new Set(list.data?.filter(row => row.status === 'ACTIVE').map(row => row.userId))
  const availableUsers = options.data?.users.filter(user => !assignedIds.has(user.userId)) ?? []
  const selected = availableUsers.find(user => user.userId === userId)

  useFormChanges(Boolean(userId || role || notes), busy)

  const refresh = () => {
    list.retry()
    options.retry()
    onChanged?.()
  }

  async function assign(e: FormEvent) {
    e.preventDefault()
    if (
      lock.current ||
      uncertain ||
      !canAssign ||
      list.loading ||
      list.error ||
      options.loading ||
      options.error ||
      !options.data ||
      !selected?.allowedRoles.includes(role) ||
      list.data?.some(r => r.userId === userId && r.status === 'ACTIVE')
    ) {
      return
    }

    lock.current = true
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await cruiseStaffApi.assign(cruiseId, { userId, roleInCruise: role, notes })
      setSuccess('Đã phân công nhân sự cho chuyến khởi hành. Hồ sơ chuẩn bị và điều kiện sẵn sàng cần đối chiếu lại.')
      setUserId('')
      setRole('')
      setNotes('')
      refresh()
    } catch (reason) {
      if (mutationOutcomeUnknown(reason)) setUncertain(true)
      setError(businessErrorMessage(reason instanceof ApiError ? reason.code : undefined, reason instanceof Error ? reason.message : ''))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (!canRead) {
    return (
      <Notice title="Chưa có quyền xem nhân sự chuyến khởi hành">
        Không thể kết luận chuyến chưa có nhân sự khi chưa đọc được dữ liệu.
      </Notice>
    )
  }

  const activeCount = list.data?.filter(r => r.status === 'ACTIVE').length ?? 0
  const panelSubtitle = list.loading
    ? 'Đang tải danh sách nhân sự…'
    : activeCount > 0
      ? `Đang có ${activeCount} nhân sự trực tiếp phục vụ trên chuyến`
      : 'Chưa có nhân sự nào được phân công cho chuyến này'

  return (
    <Panel title="Nhân sự chuyến khởi hành" subtitle={panelSubtitle}>
      <div className={styles.container}>
        {/* Toolbar & Meta */}
        <div className={styles.headerToolbar}>
          <div className={styles.metaSummary}>
            <span className={styles.metaBadge}>
              Đang hoạt động: <strong>{activeCount}</strong>
            </span>
            <span>Tổng lượt phân công: <strong>{list.data?.length ?? 0}</strong></span>
          </div>
          <Button tone="secondary" size="compact" autoWidth disabled={busy || list.loading} onClick={refresh}>
            Đối chiếu danh sách
          </Button>
        </div>

        {/* Global Notices */}
        {list.error && (
          <Notice title="Chưa tải được danh sách phân công" tone="error">
            <p>{list.error.message}</p>
            <Button tone="secondary" size="compact" autoWidth onClick={list.retry}>Tải lại</Button>
          </Notice>
        )}
        {error && <Notice title="Chưa phân công được" tone="error">{error}</Notice>}
        {success && <Notice title="Đã lưu phân công" tone="success">{success}</Notice>}
        {uncertain && (
          <Notice title="Chưa xác định kết quả phân công" tone="warning">
            <p>Đối chiếu danh sách đã lưu trước khi tạo yêu cầu mới. Biểu mẫu gửi lại đang khóa.</p>
            <Button tone="secondary" size="compact" autoWidth onClick={refresh}>Tải lại để đối chiếu</Button>
          </Notice>
        )}

        {/* Staff Table Section */}
        <section className={styles.staffTableSection} aria-label="Danh sách phân công nhân sự">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionHeading}>Danh sách phân công và lịch sử nhân sự</h3>
          </div>

          {list.loading && <Loading label="Đang tải danh sách nhân sự…" />}
          {!list.loading && !list.error && list.data?.length === 0 && (
            <Empty title="Chuyến chưa được phân công nhân sự" />
          )}

          {!list.loading && !list.error && Boolean(list.data?.length) && (
            <DataTable
              label="Phân công và lịch sử nhân sự"
              headers={['Nhân sự', 'Vai trò trên chuyến', 'Trạng thái', 'Phân công', 'Kết thúc', 'Thao tác']}
            >
              {list.data?.map(row => (
                <tr key={row.cruiseStaffId}>
                  <td>
                    <div className={styles.staffIdentity}>
                      <span className={styles.staffName}>{row.username}</span>
                      {row.notes && <span className={styles.staffNote}>{row.notes}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={styles.roleName}>{operationsStaffRole(row.roleInCruise)}</span>
                  </td>
                  <td>
                    <Badge
                      label={operationsStaffStatus(row.status)}
                      tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td>
                    <div className={styles.timeInfo}>
                      <span className={styles.timeVal}>{journeyTime(row.assignedAt)}</span>
                      <span className={styles.timeActor}>{row.assignedByName ?? 'Hệ thống'}</span>
                    </div>
                  </td>
                  <td>
                    {row.endedAt ? (
                      <div className={styles.timeInfo}>
                        <span className={styles.timeVal}>{journeyTime(row.endedAt)}</span>
                        <span className={styles.timeActor}>{row.endedByName ?? 'Hệ thống'}</span>
                      </div>
                    ) : (
                      <span className={styles.mutedText}>—</span>
                    )}
                  </td>
                  <td>
                    {row.status === 'ACTIVE' && canRemove && (
                      <DepartureCommand
                        label="Kết thúc phân công"
                        size="compact"
                        tone="danger"
                        permissions={['CRUISE_STAFF_REMOVE']}
                        disabled={busy}
                        run={() => cruiseStaffApi.remove(cruiseId, row.cruiseStaffId, row.userId)}
                        onChanged={refresh}
                        explanation={`Kết thúc phân công ${row.username} trên chuyến này. Lịch sử phân công được giữ nguyên; hồ sơ chuẩn bị được đánh giá lại.`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        {/* New Assignment Form Section */}
        {canAssign && (
          <section className={styles.assignmentCard} aria-label="Phân công nhân sự mới">
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Phân công nhân sự mới vào chuyến</h3>
              <p className={styles.cardSubtitle}>
                Chỉ các tài khoản đủ điều kiện phân quyền và không bị trùng lịch tàu mới hiển thị để chọn. Để đạt điều kiện hồ sơ xuất bến, chuyến cần tối thiểu 1 nhân sự có vai trò <strong>"Nhân viên phục vụ trên tàu (Onboard Staff)"</strong>.
              </p>
            </div>

            {options.loading && <Loading label="Đang đối chiếu tài khoản và vai trò khả dụng…" />}
            {options.error && (
              <Notice title="Chưa tải được tài khoản để phân công" tone="error">
                <p>{options.error.message}</p>
                <Button tone="secondary" size="compact" autoWidth onClick={options.retry}>Thử lại</Button>
              </Notice>
            )}

            {!options.loading && !options.error && options.data && availableUsers.length === 0 && (
              <p className={styles.emptyCandidates}>
                Không còn tài khoản đủ điều kiện để phân công (tất cả nhân sự hợp lệ đã được phân công trên chuyến này hoặc đang kẹt lịch).
              </p>
            )}

            {availableUsers.length > 0 && (
              <form className={styles.assignmentForm} onSubmit={assign}>
                <div className={styles.formRowGrid}>
                  <Field htmlFor="cruise-staff-user" label="Nhân viên">
                    <select
                      id="cruise-staff-user"
                      required
                      disabled={busy || uncertain || options.loading}
                      value={userId}
                      onChange={e => {
                        setUserId(e.target.value)
                        setRole('')
                      }}
                    >
                      <option value="">Chọn tài khoản đủ điều kiện ({availableUsers.length})</option>
                      {availableUsers.map(u => (
                        <option key={u.userId} value={u.userId}>
                          {u.username}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field htmlFor="cruise-staff-role" label="Vai trò trên chuyến">
                    <select
                      id="cruise-staff-role"
                      required
                      disabled={!selected || busy || uncertain || options.loading}
                      value={role}
                      onChange={e => setRole(e.target.value)}
                    >
                      <option value="">
                        {selected ? 'Chọn vai trò được hỗ trợ' : 'Vui lòng chọn nhân viên trước'}
                      </option>
                      {selected?.allowedRoles.map(value => (
                        <option key={value} value={value}>
                          {operationsStaffRole(value)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field htmlFor="cruise-staff-notes" label="Ghi chú phân công (tùy chọn)">
                  <textarea
                    id="cruise-staff-notes"
                    rows={2}
                    placeholder="Nhập ghi chú nhiệm vụ, ca trực hoặc lưu ý đặc biệt..."
                    value={notes}
                    disabled={busy || uncertain}
                    onChange={e => setNotes(e.target.value)}
                  />
                </Field>

                <div className={styles.formFooter}>
                  <Button
                    type="submit"
                    tone="primary"
                    autoWidth
                    disabled={
                      busy ||
                      uncertain ||
                      list.loading ||
                      Boolean(list.error) ||
                      options.loading ||
                      !selected?.allowedRoles.includes(role)
                    }
                  >
                    {busy ? 'Đang phân công…' : 'Phân công nhân viên'}
                  </Button>
                  <p className={styles.formHelpText}>
                    Trạng thái tài khoản, vai trò và lịch trùng được kiểm tra tự động khi lưu.
                  </p>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </Panel>
  )
}

export function CruiseStaffAssignments(props: { cruiseId: string; onChanged?: () => void }) {
  return (
    <UnsavedForms>
      <StaffAssignmentsWorkspace {...props} />
    </UnsavedForms>
  )
}
