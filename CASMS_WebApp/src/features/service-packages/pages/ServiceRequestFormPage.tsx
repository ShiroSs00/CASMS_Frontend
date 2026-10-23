import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BookingPassengerPicker } from '@/domain/booking-context'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, Notice, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import type { ServiceRequest } from '../model/catalog'
import { serviceSlots } from '../api/schedule-api'
import styles from '../components/Catalog.module.css'

export function ServiceRequestFormPage() {
  const { id } = useParams()
  const load = useCallback((signal: AbortSignal) => id ? servicePackageApi.request(id, signal) : Promise.resolve(null), [id])
  const query = useReadQuery(`request-form:${id}`, load)
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / YÊU CẦU" title={id ? 'Chỉnh sửa yêu cầu dịch vụ' : 'Tạo yêu cầu dịch vụ'} description="Số lượng và ghi chú yêu cầu được giữ riêng với hồ sơ sự cố vận hành." actions={<ButtonLink tone="secondary" to={id ? `/admin/service-requests/${id}` : '/admin/service-requests'}>Quay lại</ButtonLink>} />
    {id && <CatalogState {...query} />}{(!id || query.data) && (query.data && query.data.status !== 'REQUESTED' ? <Notice title="Yêu cầu không còn chờ tiếp nhận">Chỉ yêu cầu đang chờ tiếp nhận mới được chỉnh sửa.</Notice> : <RequestEditor key={id ?? 'new'} initial={query.data ?? undefined} />)}
  </CatalogFrame>
}
function RequestEditor({ initial }: { initial?: ServiceRequest }) {
  const access = useSessionAccess(), navigate = useNavigate()
  const services = useReadQuery('request-service-options', useCallback(signal => servicePackageApi.list('services', signal), []))
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? '')
  const [slotId, setSlotId] = useState('')
  const [openedAt] = useState(() => Date.now())
  const requestKey = useRef<{ payload: string; key: string } | null>(null)
  const slots = useReadQuery(`request-slots:${serviceId}`, useCallback(signal => !initial && serviceId ? serviceSlots(serviceId, signal) : Promise.resolve([]), [initial, serviceId]))
  const [bookingPassengerId, setBookingPassengerId] = useState(initial?.bookingPassengerId ?? '')
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1)), [note, setNote] = useState(initial?.note ?? '')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const allowed = initial ? access.has('SERVICE_REQUEST_CREATE') || access.has('SERVICE_REQUEST_EXECUTE') : access.has('SERVICE_REQUEST_CREATE')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !allowed) return
    if (!Number.isSafeInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 2147483647 || note.length > 500 || (!initial && !services.data?.some(service => service.id === serviceId && service.status === 'ACTIVE'))) { setError('Chọn dịch vụ đang hoạt động, số lượng nguyên dương và ghi chú tối đa 500 ký tự.'); return }
    if (!initial && serviceId && (slots.loading || slots.error)) { setError('Chưa tải được lịch dịch vụ. Vui lòng tải lại trước khi gửi.'); return }
    if (slotId && !slots.data?.some(slot => slot.id === slotId && slot.status === 'OPEN' && slot.remainingCapacity >= Number(quantity) && Date.parse(slot.endsAt) > Date.now())) { setError('Khung giờ không còn đủ chỗ hoặc đã kết thúc.'); return }
    const payload = JSON.stringify({ serviceId, bookingPassengerId, slotId, quantity: Number(quantity), note })
    if (requestKey.current?.payload !== payload) requestKey.current = { payload, key: crypto.randomUUID() }
    lock.current = true; setBusy(true); setError('')
    try { const saved = await servicePackageApi.saveRequest({ serviceId, bookingPassengerId, serviceScheduleId: slotId, idempotencyKey: requestKey.current.key, quantity: Number(quantity), note }, initial?.id); navigate(`/admin/service-requests/${saved.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa lưu được yêu cầu. Dữ liệu đã nhập được giữ lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Nội dung yêu cầu"><form onSubmit={submit} className={styles.stack}>
    {!initial && <><CatalogState {...services} /><Field htmlFor="request-service" label="Dịch vụ"><select id="request-service" required value={serviceId} disabled={busy || services.loading || Boolean(services.error)} onChange={event => { setServiceId(event.target.value); setSlotId('') }}><option value="">Chọn dịch vụ</option>{services.data?.map(service => <option key={service.id} value={service.id} disabled={service.status !== 'ACTIVE'}>{service.name} · {service.code}</option>)}</select></Field><BookingPassengerPicker value={bookingPassengerId} disabled={busy} allowedStatuses={['Confirmed']} onChange={passenger => setBookingPassengerId(passenger?.bookingPassengerId ?? '')} /><p>Liên kết đặt chỗ là tùy chọn; nếu chọn, hành khách phải thuộc tài khoản đang yêu cầu.</p></>}
    {initial && <ButtonLink tone="secondary" to={`/admin/services/${initial.serviceId}`}>Xem dịch vụ đã yêu cầu (không đổi)</ButtonLink>}
    {!initial && serviceId && <><CatalogState {...slots} /><Field htmlFor="request-slot" label="Khung giờ dịch vụ"><select id="request-slot" key={serviceId} value={slots.data?.some(slot => slot.id === slotId) ? slotId : ''} disabled={busy || slots.loading || Boolean(slots.error)} onChange={event => setSlotId(event.target.value)}><option value="">Không chọn khung giờ</option>{slots.data?.map(slot => <option key={slot.id} value={slot.id} disabled={slot.status !== 'OPEN' || slot.remainingCapacity < Number(quantity) || Date.parse(slot.endsAt) <= openedAt}>{new Date(slot.startsAt).toLocaleString('vi-VN')} → {new Date(slot.endsAt).toLocaleString('vi-VN')} · {slot.location} · còn {slot.remainingCapacity} chỗ</option>)}</select></Field>{slots.data?.length === 0 && <p>Chưa có khung giờ được mở cho dịch vụ này.</p>}</>}
    <Field htmlFor="request-quantity" label="Số lượng"><input id="request-quantity" required type="number" min={1} max={2147483647} step={1} disabled={busy} value={quantity} onChange={event => setQuantity(event.target.value)} /></Field>
    <Field htmlFor="request-note" label="Ghi chú"><textarea id="request-note" maxLength={500} disabled={busy} value={note} onChange={event => setNote(event.target.value)} /></Field>
    {error && <Notice title="Không lưu được yêu cầu" tone="error">{error}</Notice>}
    {!allowed && <p>Tài khoản chưa có quyền lưu yêu cầu này.</p>}
    <Button type="submit" disabled={busy || !allowed || (!initial && (!services.data || services.loading || Boolean(services.error)))}>{busy ? 'Đang lưu…' : 'Lưu yêu cầu'}</Button>
  </form></Panel>
}
