import { useCallback, useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Button, DataTable, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { settlementApi } from '../api/settlement-api'
import { BookingReadState } from './RealBookingUI'
import { bookingMoney } from '../model/booking-presentation'
import { bookingWhen } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

const states: Record<string, string> = { Pending: 'Chờ xử lý quyết toán', PaymentRequired: 'Cần thanh toán quyết toán', PartiallyPaid: 'Đã thanh toán một phần', Processing: 'Đang xử lý quyết toán', Completed: 'Đã hoàn thành quyết toán', Settled: 'Đã quyết toán', Disputed: 'Có khoản chi đang tranh chấp', Failed: 'Quyết toán chưa thành công' }
function money(value: number | string, currency: string) {
  if (typeof value === 'number') return bookingMoney(value, currency)
  // Format decimal source text without using floating-point arithmetic.
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  return match ? `${match[1]}${match[2].replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${match[3] ? ',' + match[3] : ''} ${currency}` : 'Chưa đọc được số tiền'
}
export function OnboardSettlement({ bookingId }: { bookingId: string }) {
  const access = useSessionAccess()
  const allowed = access.roles.includes('FINANCE_OFFICER') && access.has('SETTLEMENT_PROCESS')
  const query = useReadQuery(`onboard-settlement:${access.userId}:${bookingId}:${allowed}`, useCallback(async signal => {
    if (!allowed) return null
    const account = await settlementApi.account(bookingId, signal)
    return account ? { account, statement: await settlementApi.current(account.onboardAccountId, signal) } : null
  }, [allowed, bookingId]))
  const recoveryKey = `settlement-pending:${access.userId}:${bookingId}`
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [unknown, setUnknown] = useState(() => { try { return Boolean(sessionStorage.getItem(recoveryKey)) } catch { return true } })
  const lock = useRef(false)
  if (!allowed) return null
  const data = query.data, statement = data?.statement
  async function initiate() {
    if (!data || statement || lock.current || unknown) return
    lock.current = true; setBusy(true); setError('')
    try {
      try { sessionStorage.setItem(recoveryKey, data.account.onboardAccountId) }
      catch { setUnknown(true); throw new Error('Chưa lưu được tham chiếu thao tác. Chưa gửi yêu cầu lập quyết toán.') }
      await settlementApi.initiate(data.account)
      sessionStorage.removeItem(recoveryKey); setConfirm(false); query.retry()
    }
    catch (reason) {
      const unresolved = mutationOutcomeUnknown(reason)
      setUnknown(unresolved)
      if (!unresolved) { try { sessionStorage.removeItem(recoveryKey) } catch { setUnknown(true) } }
      setError(reason instanceof Error ? reason.message : 'Chưa lập được quyết toán.')
    }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Chi tiêu trên tàu và quyết toán">
    <BookingReadState {...query} />
    {!query.loading && !query.error && !data && <p>Đặt chỗ chưa có tài khoản chi tiêu trên tàu để quyết toán.</p>}
    {query.error && <Button tone="secondary" onClick={query.retry}>Tải lại tài khoản chi tiêu</Button>}
    {data && <>
      <RecordFacts entries={[
        ['Tài khoản chi tiêu', ({ PENDING_ACTIVATION: 'Chờ kích hoạt', ACTIVE: 'Đang hoạt động', POSTING_BLOCKED: 'Đã chặn ghi chi phí mới', CLOSED: 'Đã đóng', SUSPENDED: 'Tạm ngưng' } as Record<string, string>)[statement?.accountStatus ?? data.account.accountStatus] ?? 'Chưa xác định'],
        ['Tiền tệ quyết toán', data.account.currency],
        ['Quyết toán', statement ? states[statement.settlementStatus] ?? 'Đã lập bảng quyết toán' : 'Chưa lập bảng quyết toán'],
      ]} />
      {statement && <>
        <RecordFacts entries={[
          ['Tổng chi phí', money(statement.totalCharges, statement.baseCurrency)],
          ['Đã thanh toán', money(statement.totalPayments, statement.baseCurrency)],
          ['Còn phải thu', money(statement.outstandingBalance, statement.baseCurrency)],
          ['Số tiền cần hoàn', money(statement.refundDue, statement.baseCurrency)],
        ]} />
        <p className={styles.helper}>Lập lúc {bookingWhen(statement.startedAt)}{statement.completedAt ? ` · Hoàn thành ${bookingWhen(statement.completedAt)}` : ''}</p>
        <DataTable label="Các khoản trong quyết toán" headers={['Nội dung', 'Thời gian', 'Số tiền']}>
          {statement.items.map(item => <tr key={item.settlementItemId}><td>{item.description || 'Khoản chi được ghi nhận'}</td><td>{bookingWhen(item.occurredAt)}</td><td className={styles.numericCell}>{money(item.amount, item.currency)}</td></tr>)}
        </DataTable>
      </>}
      {unknown && !statement && <Notice tone="warning" title="Chưa xác nhận được kết quả lập quyết toán">Kiểm tra lại bảng quyết toán trước khi thực hiện thao tác khác.</Notice>}
      {error && !confirm && <Notice tone="error" title="Chưa lập được quyết toán">{error}</Notice>}
      <div className={styles.formActions}>
        {!statement && !unknown && data.account.accountStatus !== 'CLOSED' && <Button tone="secondary" onClick={() => setConfirm(true)}>Lập quyết toán chi tiêu trên tàu</Button>}
        <Button tone="text" disabled={busy} onClick={query.retry}>Kiểm tra lại quyết toán</Button>
      </div>
    </>}
    {confirm && data && <Modal title="Lập quyết toán chi tiêu trên tàu" busy={busy} onClose={() => { if (!busy) setConfirm(false) }} footer={<><Button tone="secondary" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</Button><Button busy={busy} disabled={unknown || busy} onClick={() => void initiate()}>Lập bảng quyết toán</Button></>}>
      <p>Hệ thống đối chiếu chi phí, khoản thanh toán và giao dịch chưa đồng bộ của tài khoản chi tiêu thuộc đặt chỗ này.</p>
      <p>Nếu không còn số dư phải thu và không có tranh chấp, hệ thống sẽ đóng tài khoản chi tiêu. Thao tác này không thực hiện thu hoặc hoàn tiền.</p>
      {error && <Notice tone={unknown ? 'warning' : 'error'} title={unknown ? 'Cần kiểm tra kết quả trước khi gửi lại' : 'Chưa lập được quyết toán'}>{error}</Notice>}
    </Modal>}
  </Panel>
}
