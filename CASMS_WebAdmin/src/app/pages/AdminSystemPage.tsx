import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { businessErrorMessage } from '@/shared/api/business-errors'
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

const activeFilterRoles = [
  'ADMIN',
  'CRUISE_MANAGER',
  'SHIP_MANAGER',
  'HR_MANAGER',
  'OPERATIONS_MANAGER',
  'ACTIVITY_SERVICE_MANAGER',
  'ONBOARD_STAFF',
  'BOOKING_AGENT',
  'FINANCE_OFFICER',
] as const

const roleCodePrefixes: Record<string, string> = {
  ADMIN: 'ADM',
  CRUISE_MANAGER: 'CRM',
  SHIP_MANAGER: 'SHP',
  HR_MANAGER: 'HRM',
  OPERATIONS_MANAGER: 'OPS',
  ACTIVITY_SERVICE_MANAGER: 'ASM',
  ONBOARD_STAFF: 'OBS',
  BOOKING_AGENT: 'BKA',
  FINANCE_OFFICER: 'FIN',
}

const CUSTOM_OPTION = '__CUSTOM__'

const departmentPositions: Record<string, string[]> = {
  'Quản trị hệ thống': ['Quản trị viên hệ thống', 'Kỹ sư vận hành hệ thống'],
  'Điều hành & Vận hành': ['Quản lý vận hành', 'Điều phối viên vận hành'],
  'Quản lý lịch trình': ['Quản lý lịch trình', 'Chuyên viên lập lịch trình'],
  'Quản lý đội tàu': ['Quản lý tàu', 'Kỹ sư kỹ thuật tàu'],
  'Quản lý nhân sự': ['Quản lý nhân sự', 'Chuyên viên nhân sự'],
  'Hoạt động & Dịch vụ': ['Quản lý hoạt động & dịch vụ', 'Điều phối dịch vụ trên tàu'],
  'Dịch vụ trên tàu': ['Nhân viên trên tàu', 'Tổ trưởng phục vụ trên tàu'],
  'Kinh doanh & Đặt chỗ': ['Nhân viên đặt chỗ', 'Chuyên viên tư vấn hành trình'],
  'Tài chính & Kế toán': ['Nhân viên tài chính', 'Kế toán đối soát'],
}

const roleDefaultOrg: Record<string, { department: string; position: string }> = {
  ADMIN: { department: 'Quản trị hệ thống', position: 'Quản trị viên hệ thống' },
  OPERATIONS_MANAGER: { department: 'Điều hành & Vận hành', position: 'Quản lý vận hành' },
  CRUISE_MANAGER: { department: 'Quản lý lịch trình', position: 'Quản lý lịch trình' },
  SHIP_MANAGER: { department: 'Quản lý đội tàu', position: 'Quản lý tàu' },
  HR_MANAGER: { department: 'Quản lý nhân sự', position: 'Quản lý nhân sự' },
  ACTIVITY_SERVICE_MANAGER: { department: 'Hoạt động & Dịch vụ', position: 'Quản lý hoạt động & dịch vụ' },
  ONBOARD_STAFF: { department: 'Dịch vụ trên tàu', position: 'Nhân viên trên tàu' },
  BOOKING_AGENT: { department: 'Kinh doanh & Đặt chỗ', position: 'Nhân viên đặt chỗ' },
  FINANCE_OFFICER: { department: 'Tài chính & Kế toán', position: 'Nhân viên tài chính' },
}

const departmentList = Object.keys(departmentPositions)
const EMPLOYEE_CODE_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,49}$/
const PHONE_REGEX = /^[+]?[0-9\s().-]{8,20}$/

const statusLabels: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'success' },
  PENDING_ACTIVATION: { label: 'Chờ kích hoạt', tone: 'warning' },
  INACTIVE: { label: 'Ngừng hoạt động', tone: 'neutral' },
  SUSPENDED: { label: 'Tạm khóa', tone: 'error' },
  LOCKED: { label: 'Đã khóa', tone: 'error' },
}

function accountStatus(status: string) {
  return statusLabels[status] ?? { label: status, tone: 'neutral' as const }
}

function validatePhone(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '')
  if (!PHONE_REGEX.test(trimmed) || digits.length < 8 || digits.length > 15) {
    return 'Số điện thoại không hợp lệ (cần 8–15 chữ số).'
  }
  return undefined
}

function suggestEmployeeCode(roleCode: string, existing: EmployeeView[]): string {
  const prefix = `NV-${roleCodePrefixes[roleCode] ?? 'STAFF'}-`
  const used = new Set(existing.map(item => item.employeeCode.toUpperCase()))
  for (let i = 1; i <= 999; i++) {
    const candidate = `${prefix}${String(i).padStart(2, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `${prefix}${Date.now().toString().slice(-4)}`
}

function resolveOrgSelectState(dept: string | null | undefined, pos: string | null | undefined) {
  const cleanDept = dept?.trim() ?? ''
  const cleanPos = pos?.trim() ?? ''
  const isKnownDept = Boolean(cleanDept && Object.hasOwn(departmentPositions, cleanDept))
  const deptSelect = !cleanDept ? '' : isKnownDept ? cleanDept : CUSTOM_OPTION
  const deptCustom = isKnownDept ? '' : cleanDept
  const knownPositions = isKnownDept ? departmentPositions[cleanDept] : []
  const isKnownPos = Boolean(cleanPos && knownPositions.includes(cleanPos))
  const posSelect = !cleanPos ? '' : isKnownPos ? cleanPos : CUSTOM_OPTION
  const posCustom = isKnownPos ? '' : cleanPos
  return { deptSelect, deptCustom, posSelect, posCustom }
}

type EmployeeFieldErrors = {
  employeeCode?: string
  fullName?: string
  email?: string
  phone?: string
  role?: string
}

function apiErrorText(reason: unknown, fallback: string) {
  if (reason instanceof ApiError) {
    if (reason.code) {
      const mapped = businessErrorMessage(reason.code, reason.message)
      if (mapped !== 'Không thể hoàn tất thao tác. Vui lòng tải lại và thử lại.') return mapped
    }
    return reason.message || fallback
  }
  return fallback
}

export function AdminSystemPage() {
  const access = useSessionAccess()
  const allowed = access.has('USER_READ')
  const isHrOrAdmin = access.roles.includes('ADMIN') || access.roles.includes('HR_MANAGER')
  const canCreateEmployee = access.canDo('USER_CREATE') && isHrOrAdmin
  const canUpdateEmployee = access.canDo('USER_UPDATE') && isHrOrAdmin
  const canChangeStatus = access.canDo('USER_STATUS_CHANGE') && isHrOrAdmin
  const canListEmployees = allowed && isHrOrAdmin

  const [creating, setCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create form state
  const [employeeCode, setEmployeeCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [deptSelect, setDeptSelect] = useState('')
  const [deptCustom, setDeptCustom] = useState('')
  const [posSelect, setPosSelect] = useState('')
  const [posCustom, setPosCustom] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<EmployeeFieldErrors>({})
  const [actionBanner, setActionBanner] = useState<{ tone: 'success' | 'error'; title: string; message: string } | null>(null)
  const lock = useRef(false)
  const errorNoticeRef = useRef<HTMLDivElement | null>(null)

  // Edit modal state
  const [editingEmployee, setEditingEmployee] = useState<EmployeeView | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editDeptSelect, setEditDeptSelect] = useState('')
  const [editDeptCustom, setEditDeptCustom] = useState('')
  const [editPosSelect, setEditPosSelect] = useState('')
  const [editPosCustom, setEditPosCustom] = useState('')
  const [editFieldErrors, setEditFieldErrors] = useState<EmployeeFieldErrors>({})
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  // Inactivate modal state
  const [inactivatingEmployee, setInactivatingEmployee] = useState<EmployeeView | null>(null)
  const [inactivateReason, setInactivateReason] = useState('')
  const [inactivateError, setInactivateError] = useState('')
  const [inactivateBusy, setInactivateBusy] = useState(false)

  // Retry activation email state
  const [retryingEmployeeId, setRetryingEmployeeId] = useState<string | null>(null)

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
    return apiRequest<EmployeeView[]>('/employees', { query: { page: 0, size: 100 }, signal })
  }, [canListEmployees])

  const loadRoles = useCallback(async (signal: AbortSignal) => {
    if (!canCreateEmployee) return [] as string[]
    return apiRequest<string[]>('/employees/assignable-roles', { signal })
  }, [canCreateEmployee])

  const query = useReadQuery(`system-users:${access.userId}:${allowed}`, loadUsers)
  const employeesQuery = useReadQuery(`system-employees:${access.userId}:${canListEmployees}`, loadEmployees)
  const rolesQuery = useReadQuery(`system-assignable-roles:${access.userId}:${canCreateEmployee}`, loadRoles)

  const employeeRolesByUserId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const emp of employeesQuery.data ?? []) {
      map.set(emp.userId, emp.roles)
    }
    return map
  }, [employeesQuery.data])

  const normalizedQuery = searchTerm.trim().toLocaleLowerCase('vi')
  const filteredEmployees = (employeesQuery.data ?? []).filter(emp => {
    if (roleFilter && !emp.roles.includes(roleFilter)) return false
    if (statusFilter && emp.status !== statusFilter) return false
    if (!normalizedQuery) return true
    return [emp.employeeCode, emp.fullName, emp.email, emp.department ?? '', emp.position ?? '', ...emp.roles.map(r => roleLabels[r] ?? r)]
      .some(value => value.toLocaleLowerCase('vi').includes(normalizedQuery))
  })

  const filteredUsers = (query.data ?? []).filter(user => {
    if (statusFilter && user.status !== statusFilter) return false
    if (roleFilter) {
      const roles = employeeRolesByUserId.get(user.id)
      const label = (roleLabels[roleFilter] ?? roleFilter).toLocaleLowerCase('vi')
      const matchesRoles = roles ? roles.includes(roleFilter) : false
      const matchesCapability = Boolean(user.capabilityLabel?.toLocaleLowerCase('vi').includes(label))
      if (!matchesRoles && !matchesCapability) return false
    }
    if (!normalizedQuery) return true
    return [user.username, user.displayName ?? '', user.capabilityLabel ?? '']
      .some(value => value.toLocaleLowerCase('vi').includes(normalizedQuery))
  })
  const hasFilters = Boolean(searchTerm.trim() || roleFilter || statusFilter)

  function resetForm() {
    setEmployeeCode('')
    setFullName('')
    setEmail('')
    setPhone('')
    setDeptSelect('')
    setDeptCustom('')
    setPosSelect('')
    setPosCustom('')
    setRole('')
    setSaveError('')
    setFieldErrors({})
  }

  function revealFormError() {
    requestAnimationFrame(() => {
      errorNoticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function handleRoleChange(nextRole: string) {
    setRole(nextRole)
    if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: undefined }))
    if (nextRole) {
      if (!employeeCode.trim()) {
        setEmployeeCode(suggestEmployeeCode(nextRole, employeesQuery.data ?? []))
        if (fieldErrors.employeeCode) setFieldErrors(prev => ({ ...prev, employeeCode: undefined }))
      }
      const preset = roleDefaultOrg[nextRole]
      if (preset && !deptSelect) {
        setDeptSelect(preset.department)
        setDeptCustom('')
        setPosSelect(preset.position)
        setPosCustom('')
      }
    }
  }

  function resolveDepartmentValue(selectValue: string, customValue: string) {
    return (selectValue === CUSTOM_OPTION ? customValue : selectValue).trim() || null
  }

  function resolvePositionValue(selectValue: string, customValue: string) {
    return (selectValue === CUSTOM_OPTION ? customValue : selectValue).trim() || null
  }

  async function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !canCreateEmployee) return
    const code = employeeCode.trim()
    const name = fullName.trim()
    const mail = email.trim()
    const nextErrors: EmployeeFieldErrors = {}
    if (!code) nextErrors.employeeCode = 'Vui lòng nhập mã nhân viên.'
    else if (!EMPLOYEE_CODE_REGEX.test(code)) {
      nextErrors.employeeCode = 'Mã nhân viên chỉ gồm chữ không dấu, số, dấu chấm/gạch ngang/gạch dưới và bắt đầu bằng chữ hoặc số (tối đa 50 ký tự).'
    }
    if (!name) nextErrors.fullName = 'Vui lòng nhập họ và tên.'
    if (!mail) nextErrors.email = 'Vui lòng nhập email công việc.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) nextErrors.email = 'Email chưa đúng định dạng.'
    const phoneErr = validatePhone(phone)
    if (phoneErr) nextErrors.phone = phoneErr
    if (!role) nextErrors.role = 'Vui lòng chọn vai trò phân công.'
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setSaveError('Vui lòng kiểm tra các thông tin bắt buộc còn thiếu hoặc chưa hợp lệ bên dưới.')
      revealFormError()
      return
    }
    lock.current = true
    setSaving(true)
    setSaveError('')
    setFieldErrors({})
    try {
      const created = await apiRequest<EmployeeView>('/employees', {
        method: 'POST',
        body: {
          employeeCode: code,
          fullName: name,
          email: mail,
          phone: phone.trim() || null,
          department: resolveDepartmentValue(deptSelect, deptCustom),
          position: resolvePositionValue(posSelect, posCustom),
          role,
        },
      })
      setActionBanner({
        tone: 'success',
        title: 'Đã bổ sung nhân sự mới',
        message: `Đã tạo nhân viên ${created.fullName} (${created.employeeCode}) với vai trò ${roleLabels[role] ?? role}. Tên đăng nhập là ${created.email}; email kích hoạt tài khoản (hiệu lực 7 ngày) đã được đưa vào hàng đợi gửi.`,
      })
      setCreating(false)
      resetForm()
      employeesQuery.retry()
      query.retry()
    } catch (reason) {
      const text = apiErrorText(reason, 'Chưa tạo được tài khoản nhân viên.')
      if (reason instanceof ApiError) {
        if (reason.code === 'EMPLOYEE_EMAIL_EXISTS') setFieldErrors({ email: text })
        else if (reason.code === 'EMPLOYEE_CODE_EXISTS') setFieldErrors({ employeeCode: text })
        else if (reason.code === 'EMPLOYEE_ROLE_FORBIDDEN') setFieldErrors({ role: text })
      }
      setSaveError(text)
      revealFormError()
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  function openEditModal(emp: EmployeeView) {
    const org = resolveOrgSelectState(emp.department, emp.position)
    setEditingEmployee(emp)
    setEditFullName(emp.fullName)
    setEditEmail(emp.email)
    setEditPhone(emp.phone ?? '')
    setEditDeptSelect(org.deptSelect)
    setEditDeptCustom(org.deptCustom)
    setEditPosSelect(org.posSelect)
    setEditPosCustom(org.posCustom)
    setEditFieldErrors({})
    setEditError('')
  }

  async function submitEditEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingEmployee || editBusy || !canUpdateEmployee) return
    const name = editFullName.trim()
    const mail = editEmail.trim()
    const nextErrors: EmployeeFieldErrors = {}
    if (!name) nextErrors.fullName = 'Vui lòng nhập họ và tên.'
    if (!mail) nextErrors.email = 'Vui lòng nhập email công việc.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) nextErrors.email = 'Email chưa đúng định dạng.'
    const phoneErr = validatePhone(editPhone)
    if (phoneErr) nextErrors.phone = phoneErr
    if (Object.keys(nextErrors).length > 0) {
      setEditFieldErrors(nextErrors)
      setEditError('Vui lòng kiểm tra các thông tin còn thiếu hoặc chưa hợp lệ bên dưới.')
      return
    }
    setEditBusy(true)
    setEditError('')
    setEditFieldErrors({})
    try {
      const updated = await apiRequest<EmployeeView>(`/employees/${encodeURIComponent(editingEmployee.employeeId)}`, {
        method: 'PUT',
        body: {
          fullName: name,
          email: mail,
          phone: editPhone.trim() || null,
          department: resolveDepartmentValue(editDeptSelect, editDeptCustom),
          position: resolvePositionValue(editPosSelect, editPosCustom),
        },
      })
      setEditingEmployee(null)
      setActionBanner({
        tone: 'success',
        title: 'Đã cập nhật hồ sơ nhân viên',
        message: `Đã lưu thay đổi cho ${updated.fullName} (${updated.employeeCode}).`,
      })
      employeesQuery.retry()
      query.retry()
    } catch (reason) {
      const text = apiErrorText(reason, 'Chưa cập nhật được hồ sơ nhân viên.')
      if (reason instanceof ApiError && reason.code === 'EMPLOYEE_EMAIL_EXISTS') {
        setEditFieldErrors({ email: text })
      }
      setEditError(text)
    } finally {
      setEditBusy(false)
    }
  }

  async function submitInactivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inactivatingEmployee || inactivateBusy || !canChangeStatus) return
    const reason = inactivateReason.trim()
    if (!reason) {
      setInactivateError('Vui lòng nhập lý do vô hiệu hóa tài khoản nhân viên.')
      return
    }
    setInactivateBusy(true)
    setInactivateError('')
    try {
      await apiRequest<EmployeeView>(`/employees/${encodeURIComponent(inactivatingEmployee.employeeId)}/inactivate`, {
        method: 'POST',
        body: { reason },
      })
      const target = inactivatingEmployee
      setInactivatingEmployee(null)
      setInactivateReason('')
      setActionBanner({
        tone: 'success',
        title: 'Đã vô hiệu hóa tài khoản nhân viên',
        message: `Tài khoản ${target.fullName} (${target.employeeCode}) đã được chuyển sang trạng thái ngừng hoạt động.`,
      })
      employeesQuery.retry()
      query.retry()
    } catch (reasonErr) {
      setInactivateError(apiErrorText(reasonErr, 'Chưa thể vô hiệu hóa tài khoản nhân viên.'))
    } finally {
      setInactivateBusy(false)
    }
  }

  async function retryActivationEmail(emp: EmployeeView) {
    if (!canUpdateEmployee || retryingEmployeeId) return
    setRetryingEmployeeId(emp.employeeId)
    setActionBanner(null)
    try {
      await apiRequest<void>(`/employees/${encodeURIComponent(emp.employeeId)}/activation-email/retry`, {
        method: 'POST',
      })
      setActionBanner({
        tone: 'success',
        title: 'Đã yêu cầu gửi lại email kích hoạt',
        message: `Đã đưa yêu cầu gửi lại email kích hoạt cho ${emp.fullName} (${emp.email}) vào hàng đợi xử lý.`,
      })
    } catch (reasonErr) {
      setActionBanner({
        tone: 'error',
        title: 'Chưa gửi lại được email kích hoạt',
        message: apiErrorText(reasonErr, 'Chưa gửi lại được email kích hoạt. Vui lòng thử lại sau.'),
      })
    } finally {
      setRetryingEmployeeId(null)
    }
  }

  const createPositions = deptSelect && deptSelect !== CUSTOM_OPTION ? (departmentPositions[deptSelect] ?? []) : []
  const editPositions = editDeptSelect && editDeptSelect !== CUSTOM_OPTION ? (departmentPositions[editDeptSelect] ?? []) : []
  const showEmployeeActions = canUpdateEmployee || canChangeStatus

  return (
    <AdminShell>
      <PageHeader
        breadcrumb="HỆ THỐNG / NHÂN SỰ"
        title="Tài khoản nhân sự"
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

      {actionBanner && (
        <Notice title={actionBanner.title} tone={actionBanner.tone}>
          {actionBanner.message}
        </Notice>
      )}

      {allowed && (
        <CollectionSummary
          count={query.loading || query.error ? null : query.data?.length ?? null}
          label="Tài khoản đang hoạt động"
          scope="Kết quả danh sách được phép xem"
        />
      )}

      {allowed && (
        <Panel title="Tìm kiếm và lọc nhân sự">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '16px', alignItems: 'end' }}>
            <Field htmlFor="system-search" label="Tìm kiếm">
              <input
                id="system-search"
                type="search"
                placeholder="Mã NV, họ tên, email, tài khoản…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </Field>
            {canListEmployees && (
              <Field htmlFor="system-role-filter" label="Vai trò">
                <select id="system-role-filter" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                  <option value="">Tất cả vai trò</option>
                  {activeFilterRoles.map(code => (
                    <option key={code} value={code}>{roleLabels[code] ?? code}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field htmlFor="system-status-filter" label="Trạng thái">
              <select id="system-status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statusLabels).map(([code, meta]) => (
                  <option key={code} value={code}>{meta.label}</option>
                ))}
              </select>
            </Field>
            <div>
              <Button tone="secondary" autoWidth disabled={!hasFilters} onClick={() => { setSearchTerm(''); setRoleFilter(''); setStatusFilter('') }}>
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {canListEmployees && (
        <Panel title={`Hồ sơ nhân viên (${filteredEmployees.length})`}>
          {employeesQuery.loading && <Loading label="Đang tải hồ sơ nhân viên…" />}
          {employeesQuery.error && (
            <Notice title="Không tải được hồ sơ nhân viên" tone="error">
              {employeesQuery.error.message}{' '}
              <Button tone="secondary" size="compact" autoWidth onClick={employeesQuery.retry}>
                Thử lại
              </Button>
            </Notice>
          )}
          {employeesQuery.data && filteredEmployees.length === 0 && (
            <Empty title={hasFilters ? 'Không tìm thấy hồ sơ nhân viên phù hợp' : 'Chưa có hồ sơ nhân viên nào được tạo'} />
          )}
          {employeesQuery.data && filteredEmployees.length > 0 && (
            <DataTable
              label="Danh sách hồ sơ nhân viên"
              headers={[
                'Mã NV',
                'Họ và tên',
                'Email',
                'Vai trò',
                'Bộ phận / Chức danh',
                'Trạng thái',
                ...(showEmployeeActions ? ['Thao tác'] : []),
              ]}
            >
              {filteredEmployees.map(emp => {
                const st = accountStatus(emp.status)
                const isSelf = emp.userId === access.userId
                return (
                  <tr key={emp.employeeId}>
                    <th scope="row">{emp.employeeCode}</th>
                    <td>{emp.fullName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.roles.map(r => roleLabels[r] ?? r).join(', ') || '—'}</td>
                    <td>{[emp.department, emp.position].filter(Boolean).join(' · ') || '—'}</td>
                    <td>
                      <Badge label={st.label} tone={st.tone} />
                    </td>
                    {showEmployeeActions && (
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {canUpdateEmployee && (
                            <Button tone="secondary" size="compact" autoWidth onClick={() => openEditModal(emp)}>
                              Sửa
                            </Button>
                          )}
                          {canUpdateEmployee && emp.status === 'PENDING_ACTIVATION' && (
                            <Button
                              tone="secondary"
                              size="compact"
                              autoWidth
                              busy={retryingEmployeeId === emp.employeeId}
                              disabled={Boolean(retryingEmployeeId)}
                              onClick={() => void retryActivationEmail(emp)}
                            >
                              Gửi lại email
                            </Button>
                          )}
                          {canChangeStatus && emp.status !== 'INACTIVE' && !isSelf && (
                            <Button
                              tone="danger"
                              size="compact"
                              autoWidth
                              onClick={() => {
                                setInactivatingEmployee(emp)
                                setInactivateReason('')
                                setInactivateError('')
                              }}
                            >
                              Vô hiệu hóa
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </DataTable>
          )}
        </Panel>
      )}

      <Panel title={`Tài khoản đang hoạt động (${filteredUsers.length})`}>
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
        {allowed && query.data && !filteredUsers.length && <Empty title={hasFilters ? 'Không có tài khoản khớp bộ lọc' : 'Chưa có tài khoản trong danh sách'} />}
        {allowed && query.data && filteredUsers.length > 0 && (
          <DataTable
            label="Tài khoản đang hoạt động"
            headers={['Tên đăng nhập', 'Tên hiển thị', 'Trạng thái', 'Khả năng được phân công']}
          >
            {filteredUsers.map(user => {
              const st = accountStatus(user.status)
              return (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.displayName ?? '—'}</td>
                  <td>
                    <Badge label={st.label} tone={st.tone} />
                  </td>
                  <td>{user.capabilityLabel ?? '—'}</td>
                </tr>
              )
            })}
          </DataTable>
        )}
      </Panel>

      {creating && canCreateEmployee && (
        <Modal
          wide
          busy={saving}
          title="Thêm nhân viên mới"
          description="Tên đăng nhập của nhân viên sẽ là email công việc. Hệ thống tự gửi email kích hoạt tài khoản (hiệu lực 7 ngày)."
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
          <form id="create-employee-form" noValidate onSubmit={submitEmployee} style={{ display: 'grid', gap: '16px' }}>
            {saveError && (
              <div ref={errorNoticeRef}>
                <Notice title="Chưa tạo được nhân viên" tone="error">{saveError}</Notice>
              </div>
            )}
            <Field htmlFor="emp-role" label="Vai trò phân công *" error={fieldErrors.role}>
              <select
                id="emp-role"
                required
                value={role}
                disabled={saving || rolesQuery.loading}
                aria-invalid={Boolean(fieldErrors.role)}
                onChange={e => handleRoleChange(e.target.value)}
              >
                <option value="">{rolesQuery.loading ? 'Đang tải vai trò…' : 'Chọn vai trò'}</option>
                {(rolesQuery.data ?? []).filter(item => item !== 'PASSENGER' && item !== 'POS').map(item => (
                  <option key={item} value={item}>
                    {roleLabels[item] ?? item}
                  </option>
                ))}
              </select>
            </Field>
            <Field htmlFor="emp-code" label="Mã nhân viên *" hint="Chữ không dấu, số, dấu chấm/gạch ngang/dưới (VD: NV-OPS-01)" error={fieldErrors.employeeCode}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="emp-code"
                  required
                  maxLength={50}
                  value={employeeCode}
                  disabled={saving}
                  aria-invalid={Boolean(fieldErrors.employeeCode)}
                  style={{ flex: 1 }}
                  onChange={e => {
                    setEmployeeCode(e.target.value)
                    if (fieldErrors.employeeCode) setFieldErrors(prev => ({ ...prev, employeeCode: undefined }))
                  }}
                />
                <Button
                  type="button"
                  tone="secondary"
                  size="compact"
                  autoWidth
                  disabled={saving}
                  onClick={() => {
                    setEmployeeCode(suggestEmployeeCode(role, employeesQuery.data ?? []))
                    if (fieldErrors.employeeCode) setFieldErrors(prev => ({ ...prev, employeeCode: undefined }))
                  }}
                >
                  Tự sinh mã
                </Button>
              </div>
            </Field>
            <Field htmlFor="emp-name" label="Họ và tên *" error={fieldErrors.fullName}>
              <input
                id="emp-name"
                required
                maxLength={180}
                value={fullName}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.fullName)}
                onChange={e => {
                  setFullName(e.target.value)
                  if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: undefined }))
                }}
              />
            </Field>
            <Field htmlFor="emp-email" label="Email công việc *" hint="Dùng làm tên đăng nhập và nhận liên kết kích hoạt tài khoản." error={fieldErrors.email}>
              <input
                id="emp-email"
                type="email"
                required
                maxLength={100}
                value={email}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.email)}
                onChange={e => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }))
                }}
              />
            </Field>
            <Field htmlFor="emp-phone" label="Số điện thoại" error={fieldErrors.phone}>
              <input
                id="emp-phone"
                type="tel"
                maxLength={30}
                value={phone}
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.phone)}
                onChange={e => {
                  setPhone(e.target.value)
                  if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: undefined }))
                }}
              />
            </Field>
            <Field htmlFor="emp-dept" label="Phòng ban">
              <select
                id="emp-dept"
                value={deptSelect}
                disabled={saving}
                onChange={e => {
                  const next = e.target.value
                  setDeptSelect(next)
                  if (next !== CUSTOM_OPTION) setDeptCustom('')
                  const nextList = departmentPositions[next] ?? []
                  if (posSelect && posSelect !== CUSTOM_OPTION && !nextList.includes(posSelect)) {
                    setPosSelect(nextList[0] ?? '')
                  }
                }}
              >
                <option value="">Chưa chọn phòng ban</option>
                {departmentList.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
                <option value={CUSTOM_OPTION}>Khác (nhập tay)</option>
              </select>
            </Field>
            {deptSelect === CUSTOM_OPTION && (
              <Field htmlFor="emp-dept-custom" label="Tên phòng ban khác">
                <input
                  id="emp-dept-custom"
                  maxLength={150}
                  value={deptCustom}
                  disabled={saving}
                  placeholder="Nhập tên phòng ban"
                  onChange={e => setDeptCustom(e.target.value)}
                />
              </Field>
            )}
            <Field htmlFor="emp-pos" label="Chức danh">
              <select
                id="emp-pos"
                value={posSelect}
                disabled={saving}
                onChange={e => {
                  const next = e.target.value
                  setPosSelect(next)
                  if (next !== CUSTOM_OPTION) setPosCustom('')
                }}
              >
                <option value="">Chưa chọn chức danh</option>
                {createPositions.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
                <option value={CUSTOM_OPTION}>Khác (nhập tay)</option>
              </select>
            </Field>
            {posSelect === CUSTOM_OPTION && (
              <Field htmlFor="emp-pos-custom" label="Tên chức danh khác">
                <input
                  id="emp-pos-custom"
                  maxLength={150}
                  value={posCustom}
                  disabled={saving}
                  placeholder="Nhập tên chức danh"
                  onChange={e => setPosCustom(e.target.value)}
                />
              </Field>
            )}
          </form>
        </Modal>
      )}

      {editingEmployee && canUpdateEmployee && (
        <Modal
          wide
          busy={editBusy}
          title={`Cập nhật hồ sơ · ${editingEmployee.employeeCode}`}
          description={
            editingEmployee.status === 'PENDING_ACTIVATION'
              ? 'Nếu đổi email khi tài khoản đang chờ kích hoạt, hệ thống sẽ tạo lại email kích hoạt mới (hiệu lực 7 ngày).'
              : 'Mã nhân viên và vai trò không thay đổi tại biểu mẫu này.'
          }
          onClose={() => { if (!editBusy) setEditingEmployee(null) }}
          footer={
            <>
              <Button tone="secondary" disabled={editBusy} data-overlay-dismiss onClick={() => setEditingEmployee(null)}>
                Hủy
              </Button>
              <Button type="submit" form="edit-employee-form" busy={editBusy} disabled={editBusy}>
                {editBusy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </>
          }
        >
          <form id="edit-employee-form" noValidate onSubmit={submitEditEmployee} style={{ display: 'grid', gap: '16px' }}>
            {editError && <Notice title="Chưa cập nhật được nhân viên" tone="error">{editError}</Notice>}
            <Field htmlFor="edit-emp-name" label="Họ và tên *" error={editFieldErrors.fullName}>
              <input
                id="edit-emp-name"
                required
                maxLength={180}
                value={editFullName}
                disabled={editBusy}
                aria-invalid={Boolean(editFieldErrors.fullName)}
                onChange={e => {
                  setEditFullName(e.target.value)
                  if (editFieldErrors.fullName) setEditFieldErrors(prev => ({ ...prev, fullName: undefined }))
                }}
              />
            </Field>
            <Field htmlFor="edit-emp-email" label="Email công việc *" error={editFieldErrors.email}>
              <input
                id="edit-emp-email"
                type="email"
                required
                maxLength={100}
                value={editEmail}
                disabled={editBusy}
                aria-invalid={Boolean(editFieldErrors.email)}
                onChange={e => {
                  setEditEmail(e.target.value)
                  if (editFieldErrors.email) setEditFieldErrors(prev => ({ ...prev, email: undefined }))
                }}
              />
            </Field>
            <Field htmlFor="edit-emp-phone" label="Số điện thoại" error={editFieldErrors.phone}>
              <input
                id="edit-emp-phone"
                type="tel"
                maxLength={30}
                value={editPhone}
                disabled={editBusy}
                aria-invalid={Boolean(editFieldErrors.phone)}
                onChange={e => {
                  setEditPhone(e.target.value)
                  if (editFieldErrors.phone) setEditFieldErrors(prev => ({ ...prev, phone: undefined }))
                }}
              />
            </Field>
            <Field htmlFor="edit-emp-dept" label="Phòng ban">
              <select
                id="edit-emp-dept"
                value={editDeptSelect}
                disabled={editBusy}
                onChange={e => {
                  const next = e.target.value
                  setEditDeptSelect(next)
                  if (next !== CUSTOM_OPTION) setEditDeptCustom('')
                  const nextList = departmentPositions[next] ?? []
                  if (editPosSelect && editPosSelect !== CUSTOM_OPTION && !nextList.includes(editPosSelect)) {
                    setEditPosSelect(nextList[0] ?? '')
                  }
                }}
              >
                <option value="">Chưa chọn phòng ban</option>
                {departmentList.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
                <option value={CUSTOM_OPTION}>Khác (nhập tay)</option>
              </select>
            </Field>
            {editDeptSelect === CUSTOM_OPTION && (
              <Field htmlFor="edit-emp-dept-custom" label="Tên phòng ban khác">
                <input
                  id="edit-emp-dept-custom"
                  maxLength={150}
                  value={editDeptCustom}
                  disabled={editBusy}
                  placeholder="Nhập tên phòng ban"
                  onChange={e => setEditDeptCustom(e.target.value)}
                />
              </Field>
            )}
            <Field htmlFor="edit-emp-pos" label="Chức danh">
              <select
                id="edit-emp-pos"
                value={editPosSelect}
                disabled={editBusy}
                onChange={e => {
                  const next = e.target.value
                  setEditPosSelect(next)
                  if (next !== CUSTOM_OPTION) setEditPosCustom('')
                }}
              >
                <option value="">Chưa chọn chức danh</option>
                {editPositions.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
                <option value={CUSTOM_OPTION}>Khác (nhập tay)</option>
              </select>
            </Field>
            {editPosSelect === CUSTOM_OPTION && (
              <Field htmlFor="edit-emp-pos-custom" label="Tên chức danh khác">
                <input
                  id="edit-emp-pos-custom"
                  maxLength={150}
                  value={editPosCustom}
                  disabled={editBusy}
                  placeholder="Nhập tên chức danh"
                  onChange={e => setEditPosCustom(e.target.value)}
                />
              </Field>
            )}
          </form>
        </Modal>
      )}

      {inactivatingEmployee && canChangeStatus && (
        <Modal
          busy={inactivateBusy}
          title={`Vô hiệu hóa tài khoản · ${inactivatingEmployee.employeeCode}`}
          description={`${inactivatingEmployee.fullName} (${inactivatingEmployee.email}) sẽ ngừng đăng nhập sau khi xác nhận.`}
          onClose={() => { if (!inactivateBusy) setInactivatingEmployee(null) }}
          footer={
            <>
              <Button tone="secondary" disabled={inactivateBusy} data-overlay-dismiss onClick={() => setInactivatingEmployee(null)}>
                Hủy
              </Button>
              <Button type="submit" form="inactivate-employee-form" tone="danger" busy={inactivateBusy} disabled={inactivateBusy}>
                {inactivateBusy ? 'Đang xử lý…' : 'Xác nhận vô hiệu hóa'}
              </Button>
            </>
          }
        >
          <form id="inactivate-employee-form" noValidate onSubmit={submitInactivate} style={{ display: 'grid', gap: '12px' }}>
            {inactivateError && <Notice title="Không thể vô hiệu hóa" tone="error">{inactivateError}</Notice>}
            <Field htmlFor="inactivate-reason" label="Lý do vô hiệu hóa *" hint="Tối đa 500 ký tự.">
              <textarea
                id="inactivate-reason"
                required
                rows={3}
                maxLength={500}
                disabled={inactivateBusy}
                value={inactivateReason}
                onChange={e => {
                  setInactivateReason(e.target.value)
                  if (inactivateError) setInactivateError('')
                }}
              />
            </Field>
          </form>
        </Modal>
      )}
    </AdminShell>
  )
}
