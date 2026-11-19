import { useRef, useState, type FormEvent } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import { realBookingApi, type BookingDetail } from '../api/real-booking-api'
import { bookingMutationFailure } from '../model/booking-mutation'

export function BookingContractAcceptance({ booking, onChanged }: { booking: BookingDetail; onChanged: () => void }) {
  const access = useSessionAccess(), lock = useRef(false)
  const [reference, setReference] = useState(''), [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [unknown, setUnknown] = useState(false)
  const allowed = access.canDo('BOOKING_CONTRACT_MANAGE') && booking.bookingStatus === 'Draft' && booking.contractStatus === 'Draft'
  async function save() {
    if (!allowed || lock.current || unknown || !reference.trim() || reference.trim().length > 255) return
    lock.current = true; setBusy(true); setError('')
    try { await realBookingApi.acceptContract(booking.bookingId, reference); setReview(false); onChanged() }
    catch (reason) { const failure = bookingMutationFailure(reason); setError(failure.message); setUnknown(failure.uncertain) }
    finally { lock.current = false; setBusy(false) }
  }
  function requestReview(event: FormEvent) { event.preventDefault(); if (!busy && !unknown && reference.trim() && reference.trim().length <= 255) setReview(true) }
  if (!allowed) return null
  return <Panel title="Ghi nhận hợp đồng đã ký">
    <p>Đối chiếu bản hợp đồng có chữ ký trước khi ghi nhận. Thao tác này không xác nhận thanh toán hoặc xác nhận đặt chỗ.</p>
    <form onSubmit={requestReview}><Field htmlFor="booking-contract-document" label="Mã hồ sơ bản ký *" hint="Tối đa 255 ký tự. Chỉ lưu mã tham chiếu hồ sơ."><input required maxLength={255} value={reference} disabled={busy || unknown} onChange={event => setReference(event.target.value)} /></Field>
      <Button type="submit" tone="secondary" disabled={busy || unknown || !reference.trim()}>Kiểm tra và ghi nhận bản ký</Button>
    </form>
    {unknown && <Notice title="Cần kiểm tra kết quả" tone="warning">Không gửi lại khi chưa xác định kết quả. <Button tone="text" onClick={onChanged}>Tải lại hồ sơ</Button></Notice>}
    {review && <Modal title="Xác nhận hợp đồng đã ký" busy={busy} onClose={() => setReview(false)} footer={<><Button tone="secondary" disabled={busy} onClick={() => setReview(false)}>Quay lại</Button><Button busy={busy} disabled={unknown} onClick={() => void save()}>Xác nhận đã đối chiếu bản ký</Button></>}>
      <p>Đặt chỗ: <strong>{booking.bookingReference}</strong></p><p>Hồ sơ bản ký: <strong>{reference.trim()}</strong></p>
      <p>Chỉ xác nhận khi hồ sơ này là bản ký đã đối chiếu của đúng đặt chỗ.</p>{error && <Notice title="Chưa ghi nhận được hợp đồng" tone="error">{error}</Notice>}
    </Modal>}
  </Panel>
}
