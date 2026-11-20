import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Field, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import { realBookingApi, type BookingDetail } from '../api/real-booking-api'
import { bookingMutationFailure } from '../model/booking-mutation'
import { canManageBooking } from '../model/booking-permissions'
import { bookingContractStatus } from '../model/real-booking-view'
import { BookingPaymentFacts, BookingStatusBadge } from './BookingRecord'
import { BookingReadState } from './RealBookingUI'
import styles from './BookingAgent.module.css'

const actionLabels = { confirm: 'Xác nhận đặt chỗ', cabin: 'Đổi cabin', cancel: 'Hủy đặt chỗ' }
const successLabels = { confirm: 'Đã xác nhận đặt chỗ', cabin: 'Đã đổi cabin', cancel: 'Đặt chỗ đã hủy' }
type Action = keyof typeof actionLabels

export function BookingOperations({ booking, legacyCancelAllowed, onChanged, onRead }: {
  booking: BookingDetail; legacyCancelAllowed: boolean; onChanged: (message: string) => void; onRead: (booking: BookingDetail) => void
}) {
  const access = useSessionAccess()
  const lock = useRef(false)
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [personId, setPersonId] = useState('')
  const [cabinId, setCabinId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [depositRejection, setDepositRejection] = useState<{ message: string; needsReadback: boolean } | null>(null)
  const [readError, setReadError] = useState('')
  const canConfirm = canManageBooking('confirm', booking.bookingStatus, access)
  const canCancel = legacyCancelAllowed && canManageBooking('cancel', booking.bookingStatus, access)
  const cabinPermission = canManageBooking('cabin', booking.bookingStatus, access)
  const legacyPassengers = booking.passengers.filter(person => !person.farePackageOfferId && person.participationStatus === 'Active')
  const hasFare = booking.passengers.some(person => person.farePackageOfferId)
  const person = legacyPassengers.find(item => item.bookingPassengerId === personId)
  const canChangeCabin = cabinPermission && legacyPassengers.length > 0
  const contractMissing = booking.contractStatus !== 'Accepted'
  const depositShort = booking.totalPaidAmount != null && booking.totalPaidAmount < booking.requiredDepositAmount

  const choosingCabin = action === 'cabin'
  const cabins = useReadQuery('booking-change-cabins:' + booking.cruiseId + ':' + choosingCabin,
    useCallback(signal => choosingCabin ? realBookingApi.cabins(booking.cruiseId, signal) : Promise.resolve(null),
      [booking.cruiseId, choosingCabin]))
  const candidates = person
    ? cabins.data?.filter(item => item.remainingCapacity > 0 && item.cabinId !== person.cabinId)
    : undefined
  const currentCabin = cabins.data?.find(item => item.cabinId === person?.cabinId)
  const targetCabin = candidates?.find(item => item.cabinId === cabinId)
  const canSubmit = action === 'confirm' ? canConfirm && !contractMissing && !depositShort && !depositRejection?.needsReadback
    : action === 'cancel' ? canCancel && Boolean(reason.trim())
    : action === 'cabin' && canChangeCabin && targetCabin != null

  function open(next: Action) {
    setError('')
    setReadError('')
    setPersonId('')
    setCabinId('')
    setReason('')
    setAction(next)
  }

  async function refreshConfirmation() {
    if (lock.current || !depositRejection) return
    lock.current = true
    setBusy(true)
    setReadError('')
    try {
      onRead(await realBookingApi.get(booking.bookingId))
      setDepositRejection({ ...depositRejection, needsReadback: false })
    } catch {
      setReadError('Chưa tải được dữ liệu đặt chỗ mới nhất. Kiểm tra kết nối rồi thử lại.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function submit() {
    if (!action || !canSubmit || lock.current || uncertain) return
    lock.current = true
    setBusy(true)
    setError('')
    if (action === 'confirm') {
      setDepositRejection(null)
      setReadError('')
    }
    try {
      const saved = action === 'confirm' ? await realBookingApi.confirm(booking.bookingId)
        : action === 'cancel' ? await realBookingApi.cancel(booking.bookingId, reason)
        : await realBookingApi.changeCabin(personId, cabinId, reason)
      if (saved.bookingId !== booking.bookingId
        || (action === 'confirm' && saved.bookingStatus !== 'Confirmed')
        || (action === 'cancel' && saved.bookingStatus !== 'Cancelled')
        || (action === 'cabin' && !saved.passengers.some(item => item.bookingPassengerId === personId && item.cabinId === cabinId))) {
        throw new Error('Phản hồi chưa xác nhận kết quả của thao tác.')
      }
      setAction(null)
      onChanged(successLabels[action])
    } catch (value) {
      const failure = bookingMutationFailure(value)
      if (action === 'confirm' && value instanceof ApiError && value.code === 'BOOKING_DEPOSIT_NOT_PAID') {
        setDepositRejection({ message: failure.message, needsReadback: true })
      } else {
        setError(failure.message)
      }
      setUncertain(failure.uncertain)
      if (failure.conflict && action === 'cabin') cabins.retry()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (!action && !canConfirm && !canCancel && !canChangeCabin && !hasFare) return null
  return <Panel title="Thao tác đặt chỗ">
    {hasFare && <p className={styles.helper}>Cabin thuộc gói vé được giữ theo nhóm đã đặt. Hệ thống chưa hỗ trợ đổi cabin cho hành khách thuộc gói vé.</p>}
    {canConfirm && contractMissing && <p className={styles.helper}>Cần ghi nhận hợp đồng đã ký trước khi xác nhận đặt chỗ.</p>}
    {canConfirm && depositShort && <p className={styles.helper}>Khoản thu đã đối soát chưa đủ mức cọc yêu cầu.</p>}
    {uncertain && <Notice title="Cần đối chiếu kết quả" tone="warning">Tải lại trang để kiểm tra trạng thái trước khi thực hiện thêm thao tác.</Notice>}
    <div className={styles.operationButtons}>
      {canConfirm && <Button tone="secondary" disabled={uncertain} onClick={() => open('confirm')}>Kiểm tra điều kiện xác nhận</Button>}
      {canChangeCabin && <Button tone="secondary" disabled={uncertain} onClick={() => open('cabin')}>Đổi cabin</Button>}
      {canCancel && <Button tone="danger" disabled={uncertain} onClick={() => open('cancel')}>Hủy đặt chỗ</Button>}
    </div>
    {action && <Modal title={actionLabels[action]} busy={busy} wide={action === 'cabin'} onClose={() => setAction(null)}
      footer={<><Button tone="secondary" disabled={busy} onClick={() => setAction(null)}>Quay lại</Button>
        <Button tone={action === 'cancel' ? 'danger' : 'primary'} busy={busy} disabled={!canSubmit || uncertain} onClick={() => void submit()}>{actionLabels[action]}</Button></>}>
      <div className={styles.dialogContent}>
        {action === 'confirm' && <>
          <RecordFacts entries={[
            ['Trạng thái đặt chỗ', <BookingStatusBadge status={booking.bookingStatus} />],
            ['Hợp đồng', bookingContractStatus(booking.contractStatus)],
          ]} />
          <BookingPaymentFacts booking={booking} />
          {contractMissing && <Notice title="Chưa ghi nhận hợp đồng đã ký" tone="warning">Đối chiếu và ghi nhận bản ký trong mục Hợp đồng.</Notice>}
          {depositRejection ? <Notice title="Hệ thống từ chối xác nhận" tone="error">
            <p>{depositRejection.message}</p>
            <p>{depositRejection.needsReadback
              ? 'Số tiền trong hộp thoại là dữ liệu ở lần tải trước. Tải lại đặt chỗ để đối chiếu.'
              : 'Đã tải số liệu hiện tại. Thông báo trên là kết quả của lần xác nhận trước.'}</p>
            <Button tone="secondary" autoWidth disabled={busy} onClick={() => void refreshConfirmation()}>Tải lại đặt chỗ</Button>
            {readError && <p role="alert">{readError}</p>}
          </Notice> : <>
            {depositShort && <Notice title="Chưa đủ cọc đã đối soát" tone="warning">Kiểm tra khoản thu trước khi xác nhận.</Notice>}
            <p>Hệ thống kiểm tra khoản thu đã đối soát và sức chứa tại thời điểm xác nhận.</p>
          </>}
        </>}
        {action === 'cabin' && <>
          <Field htmlFor="booking-person" label="Hành khách *">
            <select value={personId} disabled={busy || uncertain} onChange={event => { setPersonId(event.target.value); setCabinId('') }}>
              <option value="">Chọn hành khách</option>
              {legacyPassengers.map(item => <option key={item.bookingPassengerId} value={item.bookingPassengerId}>{item.fullName}</option>)}
            </select>
          </Field>
          <BookingReadState {...cabins} publicResource="cabin còn chỗ" />
          {candidates?.length === 0 && <Empty title="Chưa có cabin khác còn chỗ" />}
          <div className={styles.comparison}>
            <section aria-label="Cabin hiện tại">
              <h3>Cabin hiện tại</h3>
              <RecordFacts entries={[
                ['Mã cabin', person?.cabinNumber ?? (person ? 'Chưa phân cabin' : 'Chọn hành khách')],
                ['Boong', person?.deckNumber ?? 'Chưa cung cấp'],
                ['Sức chứa', currentCabin?.capacity ?? 'Chưa cung cấp'],
              ]} />
            </section>
            <section aria-label="Cabin mới">
              <h3>Cabin mới</h3>
              <Field htmlFor="booking-new-cabin" label="Cabin còn chỗ *">
                <select value={cabinId} disabled={busy || uncertain || !candidates?.length} onChange={event => setCabinId(event.target.value)}>
                  <option value="">Chọn cabin</option>
                  {candidates?.map(item => <option key={item.cabinId} value={item.cabinId}>{item.cabinNumber} · Còn {item.remainingCapacity} chỗ</option>)}
                </select>
              </Field>
              {targetCabin && <RecordFacts entries={[
                ['Boong', targetCabin.deckName ?? targetCabin.deckNumber ?? 'Chưa cung cấp'],
                ['Chỗ còn lại', targetCabin.remainingCapacity],
              ]} />}
            </section>
          </div>
        </>}
        {action === 'cancel' && <p>Hủy trực tiếp đặt chỗ {booking.bookingReference} và giải phóng cabin theo quy trình của hệ thống.</p>}
        {action !== 'confirm' && <Field htmlFor="booking-operation-reason" label={action === 'cancel' ? 'Lý do hủy *' : 'Lý do đổi cabin'}>
          <textarea value={reason} disabled={busy || uncertain} onChange={event => setReason(event.target.value)} />
        </Field>}
        {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
      </div>
    </Modal>}
  </Panel>
}
