import { useCallback, useState, type FormEvent } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Notice, PageHeader, Panel } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { BookingInstallments } from '../components/BookingInstallments'
import { PaymentLedger } from '../components/PaymentLedger'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName } from '../model/real-booking-view'
import styles from '../components/LiveBooking.module.css'

export function FinanceBookingsPage() {
  const access = useSessionAccess()
  return <FinanceWorkspace key={`${access.userId}:${access.status}`} />
}

function FinanceWorkspace() {
  const access = useSessionAccess()
  const canBookings = access.status === 'ready' && access.canDo('BOOKING_READ')
  const canPayments = access.status === 'ready' && (access.canDo('PAYMENT_READ') || access.canDo('PAYMENT_REPORT') || access.canDo('PAYMENT_PROCESS'))
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<{ id: string; reference: string; currency: string } | null>(null)
  const [bookingId, setBookingId] = useState(''), [error, setError] = useState('')
  const list = useReadQuery(`finance-bookings:${access.userId}:${canBookings}:${page}`, useCallback(signal => canBookings ? realBookingApi.list(page, undefined, undefined, signal) : Promise.resolve(null), [canBookings, page]))
  const selectedId = selected?.id ?? ''
  const detail = useReadQuery(`finance-schedule:${access.userId}:${canBookings}:${selectedId}`, useCallback(signal => canBookings && selectedId ? realBookingApi.get(selectedId, signal) : Promise.resolve(null), [canBookings, selectedId]))
  function openLedger(event: FormEvent) {
    event.preventDefault()
    if (!canPayments) return
    const id = bookingId.trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { setError('Nhập ID đặt chỗ hợp lệ từ hồ sơ bàn giao.'); return }
    const known = list.data?.content.find(row => row.bookingId.toLowerCase() === id.toLowerCase())
    setSelected({ id, reference: known?.bookingReference ?? 'Đặt chỗ được tra cứu', currency: known?.currency ?? '' }); setError('')
  }
  return <RealBookingFrame admin><PageHeader title="Tài chính & lịch thanh toán" breadcrumb="TÀI CHÍNH" description="Đối chiếu khoản thu, hợp đồng và các đợt thanh toán." />
    {!canBookings && <Notice title="Danh sách đặt chỗ chưa khả dụng">{access.status === 'loading' ? 'Đang kiểm tra quyền truy cập…' : 'Tài khoản cần quyền xem đặt chỗ để mở danh sách và hợp đồng.'}</Notice>}
    <div className={styles.financeGrid}>
    {canPayments && <Panel className={styles.financeLookup} title="Tra cứu khoản thu" subtitle="Dùng ID đặt chỗ trong hồ sơ bàn giao khi chưa mở được danh sách hoặc hợp đồng."><form onSubmit={openLedger}><Field htmlFor="finance-booking-id" label="ID đặt chỗ"><input id="finance-booking-id" required value={bookingId} onChange={event => setBookingId(event.target.value)} /></Field><Button type="submit">Mở khoản thu</Button></form>{error && <Notice title="Chưa tra cứu được" tone="error">{error}</Notice>}</Panel>}
    {canBookings && <Panel className={styles.financeList} title="Đặt chỗ"><BookingReadState {...list} />{list.data && <>
      {!list.data.content.length ? <Empty title="Chưa có đặt chỗ" /> : <DataTable label="Đặt chỗ và giá vé" headers={['Mã đặt chỗ', 'Chuyến đi', 'Trạng thái', 'Tổng giá vé', '']}>
        {list.data.content.map(item => <tr key={item.bookingId}><td>{item.bookingReference}</td><td>{item.cruiseName}</td><td>{bookingStatusName[item.bookingStatus]}</td><td>{item.agreedFareAmount != null && item.currency ? bookingMoney(item.agreedFareAmount, item.currency) : 'Chưa có'}</td><td><Button tone="secondary" onClick={() => setSelected({ id: item.bookingId, reference: item.bookingReference, currency: item.currency ?? '' })}>Xem khoản thu & lịch thanh toán</Button></td></tr>)}
      </DataTable>}
      <div className={styles.financePagination}><Button tone="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</Button><span> Trang {page + 1} </span><Button tone="secondary" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(value => value + 1)}>Trang sau</Button></div>
    </>}</Panel>}
    </div>
    {!selected && canBookings && !list.loading && !list.error && Boolean(list.data?.content.length) && <Panel title="Chi tiết khoản thu"><Empty title="Chọn đặt chỗ để xem khoản thu"><p>Mở một đặt chỗ trong danh sách hoặc tra cứu bằng ID để đối chiếu giao dịch và lịch thanh toán.</p></Empty></Panel>}
    {selected && <section aria-label={`Tài chính ${selected.reference}`}><h2>{selected.reference}</h2>
      <PaymentLedger key={selected.id} bookingId={selected.id} currency={detail.data?.currency ?? selected.currency} onChanged={() => { detail.retry(); list.retry() }} />
      {canBookings && <Panel title="Lịch thanh toán"><BookingReadState {...detail} />{detail.data && <BookingInstallments booking={detail.data} />}
        {detail.error instanceof ApiError && detail.error.status === 403 && <Notice title="Chưa truy cập được hợp đồng" tone="warning">Tài khoản chưa được phép đọc chi tiết đặt chỗ này. Bạn vẫn có thể tra cứu khoản thu phía trên bằng quyền thanh toán của mình.</Notice>}
      </Panel>}
    </section>}
  </RealBookingFrame>
}
