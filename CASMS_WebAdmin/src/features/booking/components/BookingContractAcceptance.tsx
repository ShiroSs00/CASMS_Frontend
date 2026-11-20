import { useRef, useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { realBookingApi, type BookingDetail } from '../api/real-booking-api'
import { bookingMutationFailure } from '../model/booking-mutation'
import styles from './BookingAgent.module.css'

export function BookingContractAcceptance({ booking, onChanged, onRefresh }: { booking: BookingDetail; onChanged: () => void; onRefresh: () => void }) {
  const access = useSessionAccess(), lock = useRef(false)
  const [reference, setReference] = useState(''), [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [unknown, setUnknown] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const allowed = access.canDo('BOOKING_CONTRACT_MANAGE') && booking.bookingStatus === 'Draft' && booking.contractStatus === 'Draft'
  async function save() {
    if (!allowed || lock.current || unknown || !reference.trim() || reference.trim().length > 255) return
    lock.current = true; setBusy(true); setError('')
    try { await realBookingApi.acceptContract(booking.bookingId, reference); setReview(false); onChanged() }
    catch (reason) { const failure = bookingMutationFailure(reason); setError(failure.message); setUnknown(failure.uncertain) }
    finally { lock.current = false; setBusy(false) }
  }
  function requestReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || unknown) return
    if (!reference.trim() || reference.trim().length > 255) {
      setFieldError('Nhập mã hồ sơ bản ký từ 1 đến 255 ký tự.')
      event.currentTarget.querySelector('input')?.focus()
      return
    }
    setError('')
    setReview(true)
  }
  if (!allowed) return null
  return <div className={styles.contractAction}>
    <p>Đối chiếu chữ ký và mã đặt chỗ trên hợp đồng trước khi ghi nhận bản ký.</p>
    <form noValidate onSubmit={requestReview}><Field htmlFor="booking-contract-document" label="Mã hồ sơ bản ký *" hint="Chỉ lưu mã tham chiếu hồ sơ. Tối đa 255 ký tự." error={fieldError}><input required maxLength={255} value={reference} disabled={busy || unknown} onChange={event => { setReference(event.target.value); setFieldError('') }} /></Field>
      <Button type="submit" autoWidth tone="secondary" disabled={busy || unknown}>Kiểm tra và ghi nhận bản ký</Button>
    </form>
    {unknown && <Notice title="Cần kiểm tra kết quả" tone="warning">Đối chiếu trạng thái hợp đồng trước khi gửi yêu cầu khác. <Button tone="text" onClick={onRefresh}>Tải lại hồ sơ</Button></Notice>}
    {review && <Modal title="Xác nhận hợp đồng đã ký" busy={busy} onClose={() => setReview(false)} footer={<><Button tone="secondary" disabled={busy} onClick={() => setReview(false)}>Quay lại</Button><Button busy={busy} disabled={unknown} onClick={() => void save()}>Xác nhận đã đối chiếu bản ký</Button></>}>
      <p>Đặt chỗ: <strong>{booking.bookingReference}</strong></p><p>Hồ sơ bản ký: <strong>{reference.trim()}</strong></p>
      <p>Chỉ xác nhận khi hồ sơ này là bản ký đã đối chiếu của đúng đặt chỗ.</p>{error && <Notice title="Chưa ghi nhận được hợp đồng" tone="error">{error}</Notice>}
    </Modal>}
  </div>
}
