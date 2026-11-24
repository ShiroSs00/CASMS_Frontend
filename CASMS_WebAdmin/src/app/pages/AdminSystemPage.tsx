import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { Badge, Button, CollectionSummary, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'

type UserLookup = { id: string; displayName?: string; username: string; status: string; capabilityLabel?: string }
type EmployeeView = {
  employeeId: string
  userId: string
  employeeCode: string
  fullName: string
  email: string
  phone?: string | null
  department?: string | null
  position?: string | null
  status: string
  roles: string[]
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  CRUISE_MANAGER: 'Quản lý lịch trình',
  SHIP_MANAGER: 'Quản lý tàu',
  HR_MANAGER: 'Quản lý nhân sự',
  OPERATIONS_MANAGER: 'Quản lý vận hành',
  ACTIVITY_SERVICE_MANAGER: 'Quản lý hoạt động & dịch vụ',
  ONBOARD_STAFF: 'Nhân viên trên tàu',
  BOOKING_AGENT: 'Nhân viên đặt chỗ',
  CUSTOMER_SERVICE: 'Chăm sóc khách hàng',
  CHECKIN_STAFF: 'Nhân viên làm thủ tục',
  FINANCE_OFFICER: 'Nhân viên tài chính',
}

export function AdminSystemPage() {
  const access = useSessionAccess()
  const allowed = access.has('USER_READ')
  const canCreateEmployee =
    access.canDo('USER_CREATE') && (access.roles.includes('ADMIN') || access.roles.includes('HR_MANAGER'))
  const canListEmployees =
    allowed && (access.roles.includes('ADMIN') || access.roles.includes('HR_MANAGER'))

  const [creating, setCreating] = useState(false)
  const [employeeCode, setEmployeeCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [createdBanner, setCreatedBanner] = useState('')
  const lock = useRef(false)

  const loadUsers = useCallback(async (signal: AbortSignal) => {
    if (!allowed) return []
    const users = await apiRequest<UserLookup[]>('/identity/users', { query: { status: 'ACTIVE' }, signal })
    if (!Array.isArray(users) || users.some(user => !user || typeof user.id !== 'string' || typeof user.username !== 'string' || typeof user.status !== 'string')) {
      throw new ApiError('Không đọc được danh sách tài khoản.', 502)
    }
    return users
  }, [allowed])

  const loadEmployees = useCallback(async (signal: AbortSignal) => {
    if (!canListEmployees) return []
    return apiRequest<EmployeeView[]>('/employees', { query: { page: 0, size: 50 }, signal })
  }, [canListEmployees])

  const loadRoles = useCallback(async (signal: AbortSignal) => {
    if (!canCreateEmployee) return [] as string[]
    return apiRequest<string[]>('/employees/assignable-roles', { signal })
  }, [canCreateEmployee])

  const query = useReadQuery(`system-users:${access.userId}:${allowed}`, loadUsers)
  const employeesQuery = useReadQuery(`system-employees:${access.userId}:${canListEmployees}`, loadEmployees)
  const rolesQuery = useReadQuery(`system-assignable-roles:${access.userId}:${canCreateEmployee}`, loadRoles)

  function resetForm() {
    setEmployeeCode('')
    setFullName('')
    setEmail('')
    setPhone('')
    setDepartment('')
    setPosition('')
    setRole('')
    setSaveError('')
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !canCreateEmployee) return
    const code = employeeCode.trim()
    const name = fullName.trim()
    const mail = email.trim()
    if (!code || !name || !mail || !role) {
      setSaveError('Vui lòng nhập đầy đủ mã nhân viên, họ tên, email và vai trò.')
      return
    }
    lock.current = true
    setSaving(true)
    setSaveError('')
    try {
      const created = await apiRequest<EmployeeView>('/employees', {
        method: 'POST',
        body: {
          employeeCode: code,
          fullName: name,
          email: mail,
          phone: phone.trim() || null,
          department: department.trim() || null,
          position: position.trim() || null,
          role,
        },
      })
      setCreatedBanner(`Đã tạo nhân viên ${created.fullName} (${created.employeeCode}) với vai trò ${roleLabels[role] ?? role}.`)
      setCreating(false)
      resetForm()
      employeesQuery.retry()
      query.retry()
    } catch (reason) {
      setSaveError(reason instanceof ApiError ? reason.message : 'Chưa tạo được tài khoản nhân viên.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return (
    <AdminShell>
      <PageHeader
        breadcrumb="HỆ THỐNG / NHÂN SỰ"
        title="Tài khoản nhân sự"
        description="Quản lý danh sách nhân viên và tài khoản đang hoạt động để phục vụ phân công vận hành chuyến khởi hành."
        actions={
          canCreateEmployee ? (
            <Button
              autoWidth
              onClick={() => {
                resetForm()
                setCreating(true)
              }}
            >
              + Thêm nhân viên mới
            </Button>
          ) : undefined
        }
      />

      {createdBanner && (
        <Notice title="Đã bổ sung nhân sự mới" tone="success">
          {createdBanner}
        </Notice>
      )}

      {allowed && (
        <CollectionSummary
          count={query.loading || query.error ? null : query.data?.length ?? null}
          label="Tài khoản đang hoạt động"
          scope="Kết quả danh sách được phép xem"
        />
      )}

      {canListEmployees && (
        <Panel title="Hồ sơ nhân viên">
          {employeesQuery.loading && <Loading label="Đang tải hồ sơ nhân viên…" />}
          {employeesQuery.error && (
            <Notice title="Không tải được hồ sơ nhân viên" tone="error">
              {employeesQuery.error.message}{' '}
              <Button tone="secondary" size="compact" autoWidth onClick={employeesQuery.retry}>
                Thử lại
              </Button>
            </Notice>
          )}
          {employeesQuery.data && employeesQuery.data.length === 0 && (
            <Empty title="Chưa có hồ sơ nhân viên nào được tạo" />
          )}
          {employeesQuery.data && employeesQuery.data.length > 0 && (
            <DataTable
              label="Danh sách hồ sơ nhân viên"
              headers={['Mã NV', 'Họ và tên', 'Email', 'Vai trò', 'Bộ phận / Chức danh', 'Trạng thái']}
            >
              {employeesQuery.data.map(emp => (
                <tr key={emp.employeeId}>
                  <th scope="row">{emp.employeeCode}</th>
                  <td>{emp.fullName}</td>
                  <td>{emp.email}</td>
                  <td>{emp.roles.map(r => roleLabels[r] ?? r).join(', ') || '—'}</td>
                  <td>{[emp.department, emp.position].filter(Boolean).join(' · ') || '—'}</td>
                  <td>
                    <Badge
                      label={emp.status === 'ACTIVE' ? 'Đang hoạt động' : emp.status}
                      tone={emp.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}

      <Panel title="Tài khoản đang hoạt động">
        {access.status === 'loading' && <Loading label="Đang kiểm tra quyền…" />}
        {access.status === 'error' && <Notice title="Chưa tải được quyền" tone="error">{access.error}</Notice>}
        {access.status === 'ready' && !allowed && (
          <Notice title="Chưa có quyền xem tài khoản" tone="warning">Liên hệ người quản trị phân quyền.</Notice>
        )}
        {allowed && query.loading && <Loading label="Đang tải tài khoản…" />}
        {allowed && query.error && (
          <Notice title="Không tải được tài khoản" tone="error">
            {query.error.message} <Button onClick={query.retry}>Thử lại</Button>
          </Notice>
        )}
        {allowed && query.data && !query.data.length && <Empty title="Chưa có tài khoản trong danh sách" />}
        {allowed && query.data && query.data.length > 0 && (
          <DataTable
            label="Tài khoản đang hoạt động"
            headers={['Tên đăng nhập', 'Tên hiển thị', 'Trạng thái', 'Khả năng được phân công']}
          >
            {query.data.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.displayName ?? '—'}</td>
                <td>
                  <Badge
                    label={user.status === 'ACTIVE' ? 'Đang hoạt động' : user.status}
                    tone={user.status === 'ACTIVE' ? 'success' : 'neutral'}
                  />
                </td>
                <td>{user.capabilityLabel ?? '—'}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      {creating && canCreateEmployee && (
        <Modal
          wide
          busy={saving}
          title="Thêm nhân viên mới"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button tone="secondary" disabled={saving} data-overlay-dismiss onClick={() => setCreating(false)}>
                Hủy
              </Button>
              <Button type="submit" form="create-employee-form" busy={saving} disabled={saving || rolesQuery.loading}>
                {saving ? 'Đang tạo…' : 'Tạo nhân viên'}
              </Button>
            </>
          }
        >
          <form id="create-employee-form" onSubmit={submitEmployee} style={{ display: 'grid', gap: '16px' }}>
            <Field htmlFor="emp-code" label="Mã nhân viên *" hint="Chữ, số, gạch dưới/ngang (ví dụ: NV-ONBOARD-01)">
              <input id="emp-code" required maxLength={50} value={employeeCode} disabled={saving} onChange={e => setEmployeeCode(e.target.value)} />
            </Field>
            <Field htmlFor="emp-name" label="Họ và tên *">
              <input id="emp-name" required maxLength={180} value={fullName} disabled={saving} onChange={e => setFullName(e.target.value)} />
            </Field>
            <Field htmlFor="emp-email" label="Email công việc *">
              <input id="emp-email" type="email" required maxLength={100} value={email} disabled={saving} onChange={e => setEmail(e.target.value)} />
            </Field>
            <Field htmlFor="emp-role" label="Vai trò phân công *">
              <select id="emp-role" required value={role} disabled={saving || rolesQuery.loading} onChange={e => setRole(e.target.value)}>
                <option value="">{rolesQuery.loading ? 'Đang tải vai trò…' : 'Chọn vai trò'}</option>
                {(rolesQuery.data ?? []).filter(item => item !== 'PASSENGER' && item !== 'POS').map(item => (
                  <option key={item} value={item}>
                    {roleLabels[item] ?? item}
                  </option>
                ))}
              </select>
            </Field>
            <Field htmlFor="emp-phone" label="Số điện thoại">
              <input id="emp-phone" type="tel" maxLength={30} value={phone} disabled={saving} onChange={e => setPhone(e.target.value)} />
            </Field>
            <Field htmlFor="emp-dept" label="Phòng ban">
              <input id="emp-dept" maxLength={150} value={department} disabled={saving} onChange={e => setDepartment(e.target.value)} />
            </Field>
            <Field htmlFor="emp-pos" label="Chức danh">
              <input id="emp-pos" maxLength={150} value={position} disabled={saving} onChange={e => setPosition(e.target.value)} />
            </Field>
            {saveError && <Notice title="Chưa tạo được nhân viên" tone="error">{saveError}</Notice>}
          </form>
        </Modal>
      )}
    </AdminShell>
  )
}
