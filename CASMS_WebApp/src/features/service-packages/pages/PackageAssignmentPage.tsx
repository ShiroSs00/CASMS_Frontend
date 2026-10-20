import { useCallback, useRef, useState } from 'react'
import { BookingPassengerPicker, type BookingContext, type BookingPassenger } from '@/domain/booking-context'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Empty, Field, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'

export function PackageAssignmentPage() {
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / PHÂN BỔ" title="Gói dịch vụ của hành khách" description="Quyền lợi gói gắn với hành khách trong đặt chỗ; không tự tạo đăng ký hoặc giữ chỗ hoạt động." actions={<ButtonLink tone="secondary" to="/admin/service-packages">Danh mục gói</ButtonLink>} /><BookingPackageAssignments /></CatalogFrame>
}
export function BookingPackageAssignments({ bookingId, onChanged }: { bookingId?: string; onChanged?: () => void }) {
  const access = useSessionAccess()
  const [booking, setBooking] = useState<BookingContext | null>(null), [passenger, setPassenger] = useState<BookingPassenger | null>(null)
  const [packageId, setPackageId] = useState(''), [readSelected, setReadSelected] = useState(false)
  const [method, setMethod] = useState<'POST' | 'PUT' | 'DELETE' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false), selectedBookingId = bookingId ?? booking?.bookingId
  const assignments = useReadQuery(`package-assignments:${selectedBookingId}`, useCallback(signal => servicePackageApi.assignments(selectedBookingId, signal), [selectedBookingId]))
  const packages = useReadQuery('assignable-package-options', useCallback(signal => servicePackageApi.list('packages', signal), []))
  const current = assignments.data?.find(row => row.bookingPassengerId === passenger?.bookingPassengerId)
  const passengerId = passenger?.bookingPassengerId
  const currentPackageId = current?.packageId
  const detail = useReadQuery(`package-assignment:${passengerId}:${readSelected}:${currentPackageId}`, useCallback(signal => passengerId && readSelected && currentPackageId ? servicePackageApi.assignment(passengerId, signal) : Promise.resolve(null), [passengerId, readSelected, currentPackageId]))
  const allowed = access.has('TOUR_PACKAGE_ASSIGN') && booking?.bookingStatus === 'Draft' && (!bookingId || booking.bookingId === bookingId) && passenger?.participationStatus === 'Active' && !assignments.loading && !assignments.error
  async function save() {
    if (lock.current || !method || !passengerId || !allowed || (method !== 'DELETE' && !packages.data?.some(item => item.id === packageId && item.status === 'ACTIVE'))) return
    lock.current = true; setBusy(true); setError('')
    try { await servicePackageApi.changeAssignment(passengerId, packageId, method); setMethod(null); setReadSelected(false); assignments.retry(); onChanged?.() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được phân bổ.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Phân bổ gói theo đặt chỗ">
    <BookingPassengerPicker fixedBookingId={bookingId} initialBookingId={bookingId} value={passengerId ?? ''} disabled={busy} onChange={(person, context) => { setPassenger(person); setBooking(context); setReadSelected(false); setMethod(null); setPackageId(''); setError('') }} />
    <CatalogState {...assignments} /><CatalogState {...packages} />
    {assignments.data?.length === 0 && <Empty title="Chưa có phân bổ gói trong phạm vi đang xem" />}
    {!passenger && assignments.data && assignments.data.length > 0 && <p>Có {assignments.data.length} phân bổ. Chọn đặt chỗ và hành khách để xem tên và chi tiết.</p>}
    {passenger && assignments.data && <>
      <p>{passenger.fullName} · {booking?.bookingReference}. {current ? `Giá gói đã chốt: ${current.agreedPrice} ${current.currency}.` : 'Chưa được phân bổ gói.'}</p>
      {current && <><Button tone="secondary" onClick={() => setReadSelected(true)}>Xem chi tiết phân bổ hiện tại</Button><CatalogState {...detail} />{detail.data && <p>Gói: {packages.data?.find(item => item.id === detail.data?.packageId)?.name ?? passenger.tourPackageName ?? 'Chưa tải được tên gói'} · Phân bổ lúc {new Date(detail.data.assignedAt).toLocaleString('vi-VN')}.</p>}</>}
      <Field htmlFor="assignment-package" label="Gói dịch vụ"><select id="assignment-package" value={packageId} disabled={busy || !allowed || packages.loading || Boolean(packages.error)} onChange={event => setPackageId(event.target.value)}><option value="">Chọn gói đang hoạt động</option>{packages.data?.filter(item => item.status === 'ACTIVE').map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></Field>
      <Button disabled={busy || !allowed || !packageId} onClick={() => { setMethod(current ? 'PUT' : 'POST'); setError('') }}>{current ? 'Đổi gói cho hành khách' : 'Gán gói cho hành khách'}</Button>{' '}
      {current && <Button tone="danger" disabled={busy || !allowed} onClick={() => { setMethod('DELETE'); setError('') }}>Gỡ phân bổ gói</Button>}
      {booking?.bookingStatus !== 'Draft' && <p>Chỉ đặt chỗ nháp được gán, đổi hoặc gỡ gói. Giá đã chốt sau xác nhận không được thay đổi theo luồng này.</p>}
    </>}
    {method && <Modal title={method === 'DELETE' ? 'Xác nhận gỡ gói' : 'Xác nhận phân bổ gói'} busy={busy} onClose={() => setMethod(null)}><p>{passenger?.fullName} · {booking?.bookingReference}. {method === 'DELETE' ? 'Gỡ quyền lợi gói đang gắn với hành khách.' : 'Gói phải đang hoạt động và có hiệu lực trong toàn bộ khoảng ngày của chuyến.'}</p><p>Phân bổ gói không đặt chỗ hoạt động, chuyến tham quan hoặc xử lý thanh toán.</p>{error && <Notice title="Không cập nhật được phân bổ" tone="error">{error}</Notice>}<Button disabled={busy || !allowed} onClick={() => void save()}>Xác nhận</Button></Modal>}
  </Panel>
}
