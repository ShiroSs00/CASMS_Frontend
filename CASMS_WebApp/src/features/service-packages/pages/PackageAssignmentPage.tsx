import { useCallback, useId, useRef, useState } from 'react'
import { BookingPassengerPicker, type BookingContext, type BookingPassenger } from '@/domain/booking-context'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, Empty, Field, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import styles from '../components/PackageAssignment.module.css'

function priceLabel(amount: number | null, currency: string | null) {
  if (amount === null) return 'Chưa có giá'
  return `${amount.toLocaleString('vi-VN')}${currency ? ` ${currency}` : ' · Chưa rõ tiền tệ'}`
}
function dateLabel(value: string | null | undefined, includeTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có thông tin'
  const date = new Date(value)
  return includeTime ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}
const bookingLabels = { Draft: 'Chờ xác nhận', Confirmed: 'Đã xác nhận', Cancelled: 'Đã hủy' }

export function PackageAssignmentPage() {
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / PHÂN BỔ GÓI" title="Phân bổ gói dịch vụ"
    description="Chọn hành khách, xem gói đang sử dụng và cập nhật gói phù hợp."
    actions={<ButtonLink tone="secondary" to="/admin/service-packages">Danh mục gói</ButtonLink>} />
    <BookingPackageAssignments />
  </CatalogFrame>
}
export function BookingPackageAssignments({ bookingId, onChanged }: { bookingId?: string; onChanged?: () => void }) {
  const access = useSessionAccess()
  const searchId = useId(), groupName = useId()
  const [booking, setBooking] = useState<BookingContext | null>(null), [passenger, setPassenger] = useState<BookingPassenger | null>(null)
  const [packageId, setPackageId] = useState(''), [search, setSearch] = useState('')
  const [method, setMethod] = useState<'POST' | 'PUT' | 'DELETE' | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const lock = useRef(false), selectedBookingId = bookingId ?? booking?.bookingId
  const assignments = useReadQuery(`package-assignments:${selectedBookingId}`, useCallback(signal => selectedBookingId ? servicePackageApi.assignments(selectedBookingId, signal) : Promise.resolve([]), [selectedBookingId]))
  const packages = useReadQuery('assignable-package-options', useCallback(signal => servicePackageApi.list('packages', signal), []))
  const passengerId = passenger?.bookingPassengerId
  const current = assignments.data?.find(row => row.bookingPassengerId === passengerId)
  const currentPackage = packages.data?.find(item => item.id === current?.packageId)
  const selectedPackage = packages.data?.find(item => item.id === packageId && item.status === 'ACTIVE')
  const activePackages = packages.data?.filter(item => item.status === 'ACTIVE') ?? []
  const visiblePackages = activePackages.filter(item => `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
  const hasPermission = access.has('TOUR_PACKAGE_ASSIGN')
  const allowed = hasPermission && booking?.bookingStatus === 'Draft' && (!bookingId || booking.bookingId === bookingId) && passenger?.participationStatus === 'Active' && !assignments.loading && !assignments.error
  const canSave = Boolean(allowed && selectedPackage && selectedPackage.id !== current?.packageId && !packages.loading && !packages.error)
  const currentName = currentPackage?.name ?? (passenger?.tourPackageId === current?.packageId ? passenger?.tourPackageName : null) ?? 'Gói đã phân bổ'

  async function save() {
    if (lock.current || !method || !passengerId || !allowed || (method !== 'DELETE' && !canSave)) return
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      await servicePackageApi.changeAssignment(passengerId, packageId, method)
      setSuccess(method === 'DELETE' ? `Đã gỡ gói của ${passenger?.fullName}.` : `Đã ${method === 'PUT' ? 'đổi' : 'gán'} gói ${selectedPackage?.name} cho ${passenger?.fullName}.`)
      setMethod(null); setPackageId(''); assignments.retry(); onChanged?.()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được phân bổ.') }
    finally { lock.current = false; setBusy(false) }
  }
  function confirmChange(nextMethod: 'POST' | 'PUT' | 'DELETE') {
    setError(''); setSuccess(''); setMethod(nextMethod)
  }

  return <>
    {success && <div className={styles.notice}><Notice title="Đã cập nhật phân bổ" tone="success">{success}</Notice></div>}
    <div className={styles.layout}>
      <Panel title="1. Chọn hành khách" subtitle="Chọn đặt chỗ và người được sử dụng gói.">
        <div className={styles.picker}><BookingPassengerPicker fixedBookingId={bookingId} initialBookingId={bookingId} value={passengerId ?? ''} disabled={busy}
          onChange={(person, context) => { setPassenger(person); setBooking(context); setMethod(null); setPackageId(''); setSearch(''); setError(''); setSuccess('') }} /></div>
        {passenger && booking && <>
          <div className={styles.context}>
            <div className={styles.contextTop}><span className={styles.eyebrow}>Hành khách đã chọn</span><Badge label={bookingLabels[booking.bookingStatus]} tone={booking.bookingStatus === 'Draft' ? 'warning' : 'neutral'} /></div>
            <strong>{passenger.fullName}</strong><p>{booking.bookingReference} · {booking.cruiseName}</p>
            {passenger.cabinNumber && <p>Cabin {passenger.cabinNumber}</p>}
          </div>
          <section className={styles.current} aria-label="Gói hiện tại">
            <p className={styles.eyebrow}>Gói hiện tại</p>
            <CatalogState {...assignments} />
            {assignments.data && !assignments.error && (current ? <>
              <h3>{currentName}</h3>
              <dl className={styles.facts}><div><dt>Giá đã chốt</dt><dd>{priceLabel(current.agreedPrice, current.currency)}</dd></div><div><dt>Thời điểm phân bổ</dt><dd>{dateLabel(current.assignedAt, true)}</dd></div></dl>
              {hasPermission && <Button tone="text" autoWidth disabled={busy || !allowed} onClick={() => confirmChange('DELETE')}>Gỡ gói hiện tại</Button>}
            </> : <><h3>Chưa có gói dịch vụ</h3><p className={styles.hint}>Chọn một gói trong danh sách để phân bổ cho hành khách.</p></>)}
          </section>
          {!hasPermission && <p className={styles.hint}>Bạn có thể xem phân bổ hiện tại. Cần quyền phân bổ gói để cập nhật.</p>}
          {hasPermission && booking.bookingStatus !== 'Draft' && <p className={styles.hint}>Đặt chỗ {booking.bookingStatus === 'Confirmed' ? 'đã xác nhận' : 'đã hủy'} chỉ cho phép xem. Chỉ đặt chỗ chờ xác nhận mới được gán, đổi hoặc gỡ gói.</p>}
          {passenger.participationStatus !== 'Active' && <p className={styles.hint}>Hành khách đã hủy tham gia nên không thể cập nhật gói.</p>}
        </>}
      </Panel>
      <Panel title="2. Chọn gói dịch vụ" subtitle="Tìm gói theo tên hoặc mã và xem giá tham khảo trước khi phân bổ.">
        <div className={styles.search}><Field htmlFor={searchId} label="Tìm gói dịch vụ"><input id={searchId} type="search" placeholder="Nhập tên hoặc mã gói…" value={search} onChange={event => setSearch(event.target.value)} disabled={busy || packages.loading || Boolean(packages.error)} /></Field>
          {packages.data && <p className={styles.count}>{visiblePackages.length} gói đang hoạt động</p>}
        </div>
        <CatalogState {...packages} />
        {!passenger && <p className={styles.hint}>Chọn hành khách ở phần 1 để bắt đầu phân bổ.</p>}
        {packages.data && !packages.error && (visiblePackages.length ? <fieldset className={styles.options} disabled={busy || !allowed}>
          <legend className={styles.legend}>Các gói đang hoạt động</legend>
          {visiblePackages.map(item => <label className={`${styles.option} ${packageId === item.id ? styles.selected : ''}`} key={item.id}>
            <input type="radio" name={groupName} value={item.id} checked={packageId === item.id} disabled={item.id === current?.packageId} onChange={() => { setPackageId(item.id); setError(''); setSuccess('') }} />
            <span className={styles.optionBody}>
              <span className={styles.optionHeader}><span className={styles.optionName}><strong>{item.name}</strong><small>{item.code}</small></span><span className={styles.price}><strong>{priceLabel(item.price, item.currency)}</strong><small>Giá danh mục tham khảo</small></span></span>
              {item.id === current?.packageId && <Badge label="Đang sử dụng" tone="success" />}
              {item.description && <span className={styles.description}>{item.description}</span>}
              {(item.startDate || item.endDate) && <span className={styles.dates}>Hiệu lực: {item.startDate ? dateLabel(item.startDate) : 'Chưa có ngày bắt đầu'} → {item.endDate ? dateLabel(item.endDate) : 'Chưa có ngày kết thúc'}</span>}
            </span>
          </label>)}
        </fieldset> : <Empty title={search.trim() ? 'Không tìm thấy gói phù hợp' : 'Chưa có gói đang hoạt động'}>
          <p>{search.trim() ? 'Thử tên hoặc mã khác để tìm gói.' : 'Gói đang hoạt động sẽ xuất hiện tại đây.'}</p>
          {search.trim() && <Button tone="secondary" onClick={() => setSearch('')}>Xóa tìm kiếm</Button>}
        </Empty>)}
        <div className={styles.selection}>
          <div><span className={styles.eyebrow}>Gói đã chọn</span><strong>{selectedPackage?.name ?? 'Chưa chọn gói'}</strong><p className={styles.hint}>{passenger ? `Phân bổ cho ${passenger.fullName}` : 'Vui lòng chọn hành khách trước'}</p></div>
          {hasPermission && <Button disabled={busy || !canSave} onClick={() => confirmChange(current ? 'PUT' : 'POST')}>{current ? 'Xem lại thay đổi' : 'Xem lại phân bổ'}</Button>}
        </div>
      </Panel>
    </div>
    {method && hasPermission && <Modal title={method === 'DELETE' ? 'Gỡ gói của hành khách?' : method === 'PUT' ? 'Xác nhận đổi gói' : 'Xác nhận phân bổ gói'} busy={busy} protectChanges={false} onClose={() => setMethod(null)}
      footer={<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => setMethod(null)}>Quay lại</Button><Button tone={method === 'DELETE' ? 'danger' : 'primary'} disabled={busy || !allowed || (method !== 'DELETE' && !canSave)} onClick={() => void save()}>{busy ? 'Đang cập nhật…' : method === 'DELETE' ? 'Gỡ gói' : 'Xác nhận phân bổ'}</Button></div>}>
      <dl className={styles.facts}><div><dt>Hành khách</dt><dd>{passenger?.fullName}</dd></div><div><dt>Đặt chỗ</dt><dd>{booking?.bookingReference} · {booking?.cruiseName}</dd></div>
        {current && <div><dt>Gói hiện tại</dt><dd>{currentName} · {priceLabel(current.agreedPrice, current.currency)}</dd></div>}
        {method !== 'DELETE' && <div><dt>{current ? 'Đổi sang gói' : 'Gói được phân bổ'}</dt><dd>{selectedPackage?.name} · {selectedPackage ? priceLabel(selectedPackage.price, selectedPackage.currency) : ''}</dd></div>}
      </dl>
      <p className={styles.hint}>{method === 'DELETE' ? 'Hành khách sẽ không còn được phân bổ gói hiện tại.' : 'Giá hiển thị của gói mới là giá danh mục tham khảo. Gói cần có hiệu lực trong toàn bộ khoảng ngày của chuyến; giá chốt được lấy từ kết quả phân bổ.'}</p>
      {error && <Notice title="Không cập nhật được phân bổ" tone="error">{error}</Notice>}
    </Modal>}
  </>
}
