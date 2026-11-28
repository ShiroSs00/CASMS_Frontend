import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import styles from './AdminSystem.module.css'

type Account = {
  userId: string; username: string; email: string | null; status: string
  lastLoginAt: string | null; createdAt: string | null; updatedAt: string | null
  roles: string[]; permissions: string[]
}
const groups: [RegExp, string][] = [
  [/^(USER_|POS_)/, 'Tài khoản và quyền truy cập'],
  [/^(SHIP_|DECK_|CABIN_|BLE_)/, 'Tàu, cabin và thiết bị'],
  [/^(TRIP_|CRUISE_|ITINERARY_|PORT_|DESTINATION_)/, 'Lịch trình và chuyến khởi hành'],
  [/^(BOOKING_|CHECKIN_|CHECKOUT_)/, 'Đặt chỗ và phục vụ hành khách'],
  [/^(PAYMENT_|INVOICE_|SETTLEMENT_)/, 'Thanh toán và quyết toán'],
  [/^(ACTIVITY_|EXCURSION_|TOUR_|SERVICE_|PRODUCT_|PACKAGE_|REGISTRATION_|PARTICIPATION_|SUPPLIER_)/, 'Hoạt động và dịch vụ'],
  [/^(REGULATION_|OPERATIONAL_ISSUE_)/, 'Quy định và sự cố'],
]
function time(value: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có ghi nhận'
}
export function AccountAccess({ userId, roleLabels, actions }: {
  userId: string; roleLabels: Record<string, string>; actions?: ReactNode
}) {
  const load = useCallback((signal: AbortSignal) => apiRequest<Account>(`/identity/users/${userId}/access`, { signal }), [userId])
  const query = useReadQuery(`account-access:${userId}`, load)
  const [search, setSearch] = useState('')
  const grouped = useMemo(() => {
    const result = new Map<string, string[]>()
    for (const code of query.data?.permissions ?? []) {
      const label = groups.find(([pattern]) => pattern.test(code))?.[1] ?? 'Thông báo và chức năng hỗ trợ'
      result.set(label, [...(result.get(label) ?? []), code])
    }
    return [...result]
  }, [query.data])
  if (query.loading) return <Loading label="Đang tải tài khoản và quyền truy cập…" />
  if (query.error) return <Notice title="Chưa tải được quyền truy cập" tone="error"><p>{query.error.message}</p><Button onClick={query.retry}>Tải lại tài khoản</Button></Notice>
  const account = query.data
  if (!account) return null
  return <div className={styles.detail}>
    <Panel title="Thông tin tài khoản">
      <dl className={styles.facts}>
        <div><dt>Tên đăng nhập</dt><dd>{account.username}</dd></div>
        <div><dt>Email tài khoản</dt><dd>{account.email || 'Chưa có email'}</dd></div>
        <div><dt>Truy cập hệ thống</dt><dd>{account.status === 'ACTIVE' ? 'Được phép đăng nhập' : account.status === 'LOCKED' ? 'Tài khoản đã khóa' : 'Tài khoản đã vô hiệu hóa'}</dd></div>
        <div><dt>Đăng nhập gần nhất · giờ Việt Nam</dt><dd>{time(account.lastLoginAt)}</dd></div>
        <div><dt>Ngày tạo</dt><dd>{time(account.createdAt)}</dd></div>
        <div><dt>Cập nhật tài khoản gần nhất</dt><dd>{time(account.updatedAt)}</dd></div>
      </dl>
      {actions && <div className={styles.detailActions}>{actions}</div>}
    </Panel>
    <Panel title="Vai trò và quyền truy cập">
      <div className={styles.roles}>{account.roles.map(role => <strong key={role}>{roleLabels[role] ?? (role === 'POS' ? 'Thiết bị bán hàng' : role === 'PASSENGER' ? 'Hành khách' : 'Vai trò chưa có tên hiển thị')}</strong>)}</div>
      <p className={styles.note}>Quyền theo vai trò được gán. Phạm vi chuyến và hành động còn được kiểm tra tại từng nghiệp vụ.</p>
      {account.status !== 'ACTIVE' && <p className={styles.note}>Tài khoản hiện không được đăng nhập; danh sách dưới đây không có nghĩa người dùng đang được phép truy cập.</p>}
      <div className={styles.permissionGroups}>{grouped.map(([label, codes]) => <div key={label}><span>{label}</span><span>{codes.length} quyền</span></div>)}</div>
      {!account.permissions.length && <p>Chưa có quyền nghiệp vụ được cấp qua vai trò.</p>}
      <details className={styles.permissionDetails}>
        <summary>Tra cứu mã quyền chi tiết ({account.permissions.length})</summary>
        <Field htmlFor="account-permission-search" label="Tìm mã quyền"><input id="account-permission-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
        <ul>{account.permissions.filter(code => code.toLowerCase().includes(search.trim().toLowerCase())).map(code => <li key={code}><code>{code}</code></li>)}</ul>
        {search && !account.permissions.some(code => code.toLowerCase().includes(search.trim().toLowerCase())) && <p>Không tìm thấy mã quyền phù hợp.</p>}
      </details>
    </Panel>
  </div>
}
