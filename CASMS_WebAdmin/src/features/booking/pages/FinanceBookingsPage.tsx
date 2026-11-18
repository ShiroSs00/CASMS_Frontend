import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CancellationQueue } from '@/shared/cancellation'
import { RefundHistory, RefundSummary } from '../components/RefundWorkspace'
import { UsdDisplayRate } from '../components/UsdDisplayRate'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Empty, Field, Notice, PageHeader, Panel } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { BookingInstallments } from '../components/BookingInstallments'
import { PaymentLedger } from '../components/PaymentLedger'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName, bookingWhen } from '../model/real-booking-view'
import styles from '../components/LiveBooking.module.css'

type WorkspaceTab = 'payments' | 'refunds' | 'rate'

const bookingStatusTone: Record<string, 'warning' | 'success' | 'neutral'> = {
  Draft: 'warning',
  Confirmed: 'success',
  Cancelled: 'neutral',
}

export function FinanceBookingsPage() {
  const access = useSessionAccess()
  return <FinanceWorkspace key={`${access.userId}:${access.status}`} />
}

function FinanceWorkspace() {
  const access = useSessionAccess()
  const baseId = useId()
  const canBookings = access.status === 'ready' && access.canDo('BOOKING_READ')
  const canPayments = access.status === 'ready' && (access.canDo('PAYMENT_READ') || access.canDo('PAYMENT_REPORT'))
  const canRefunds = access.status === 'ready' && access.roles.includes('FINANCE_OFFICER') && access.has('PAYMENT_REFUND')
  const canRate = access.roles.includes('FINANCE_OFFICER') && access.has('PAYMENT_REPORT')

  const tabs: { id: WorkspaceTab; label: string }[] = [
    ...(canBookings || canPayments ? [{ id: 'payments' as const, label: 'Thu tiền & đặt chỗ' }] : []),
    ...(canRefunds ? [{ id: 'refunds' as const, label: 'Hủy chỗ & hoàn tiền' }] : []),
    ...(canRate ? [{ id: 'rate' as const, label: 'Tỷ giá USD tham khảo' }] : []),
  ]
  const [requestedTab, setRequestedTab] = useState<WorkspaceTab>('payments')
  const activeTab: WorkspaceTab = tabs.some(tab => tab.id === requestedTab) ? requestedTab : (tabs[0]?.id ?? 'payments')
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement | null>>>({})

  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<{ id: string; reference: string; currency: string; cruiseName?: string; status?: string; fareAmount?: number | null } | null>(null)
  const [bookingId, setBookingId] = useState(''), [error, setError] = useState('')
  const list = useReadQuery(`finance-bookings:${access.userId}:${canBookings}:${page}`, useCallback(signal => canBookings ? realBookingApi.list(page, undefined, undefined, signal) : Promise.resolve(null), [canBookings, page]))
  const selectedId = selected?.id ?? ''
  const selectedHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (selectedId && activeTab === 'payments') selectedHeading.current?.focus()
  }, [selectedId, activeTab])
  const detail = useReadQuery(`finance-schedule:${access.userId}:${canBookings}:${selectedId}`, useCallback(signal => canBookings && selectedId ? realBookingApi.get(selectedId, signal) : Promise.resolve(null), [canBookings, selectedId]))

  function selectBooking(target: { id: string; reference: string; currency: string; cruiseName?: string; status?: string; fareAmount?: number | null }) {
    setSelected(target)
    setError('')
    setRequestedTab('payments')
  }

  function openLedger(event: FormEvent) {
    event.preventDefault()
    if (!canPayments) return
    const id = bookingId.trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setError('Nhập ID đặt chỗ hợp lệ từ hồ sơ bàn giao.')
      return
    }
    const known = list.data?.content.find(row => row.bookingId.toLowerCase() === id.toLowerCase())
    selectBooking({
      id,
      reference: known?.bookingReference ?? 'Đặt chỗ được tra cứu',
      currency: known?.currency ?? '',
      cruiseName: known?.cruiseName,
      status: known?.bookingStatus,
      fareAmount: known?.agreedFareAmount,
    })
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (tabs.length < 2) return
    let nextIndex = -1
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === -1) return
    event.preventDefault()
    const nextTab = tabs[nextIndex].id
    setRequestedTab(nextTab)
    tabRefs.current[nextTab]?.focus()
  }

  const activeCurrency = detail.data?.currency ?? selected?.currency ?? ''
  const activeReference = detail.data?.bookingReference ?? selected?.reference ?? ''
  const activeCruiseName = detail.data?.cruiseName ?? selected?.cruiseName
  const activeStatus = detail.data?.bookingStatus ?? selected?.status
  const activeFare = detail.data?.agreedFareAmount ?? selected?.fareAmount

  return <RealBookingFrame>
    <PageHeader
      breadcrumb="TÀI CHÍNH"
      title="Tài chính & lịch thanh toán"
      description="Chọn đặt chỗ hoặc tra cứu theo ID để ghi nhận khoản thu, đối chiếu lịch thanh toán hợp đồng và xử lý hoàn tiền."
    />

    {!canBookings && <Notice title="Danh sách đặt chỗ chưa khả dụng">
      {access.status === 'loading' ? 'Đang kiểm tra quyền truy cập…' : 'Tài khoản cần quyền xem đặt chỗ để mở danh sách và hợp đồng.'}
    </Notice>}

    <div className={styles.financeWorkbench}>
      {tabs.length > 1 && <div className={styles.financeTabs} role="tablist" aria-label="Khu vực nghiệp vụ tài chính">
        {tabs.map((tab, index) => <button
          key={tab.id}
          ref={node => { tabRefs.current[tab.id] = node }}
          id={`${baseId}-tab-${tab.id}`}
          type="button"
          role="tab"
          className={styles.financeTab}
          aria-selected={activeTab === tab.id}
          aria-controls={`${baseId}-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => setRequestedTab(tab.id)}
          onKeyDown={event => onTabKeyDown(event, index)}
        >{tab.label}</button>)}
      </div>}

      {(canBookings || canPayments) && activeTab === 'payments' && <div
        id={`${baseId}-panel-payments`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${baseId}-tab-payments` : undefined}
        className={styles.financeTabPanel}
      >
        {canPayments && <Panel title="Tra cứu nhanh khoản thu" subtitle="Nhập ID đặt chỗ từ hồ sơ bàn giao nếu bạn muốn mở thẳng một hồ sơ cụ thể.">
          <form className={styles.financeQuickLookupForm} onSubmit={openLedger}>
            <Field htmlFor="finance-booking-id" label="ID đặt chỗ (UUID)">
              <input id="finance-booking-id" required placeholder="Ví dụ: 3fa85f64-5717-4562-b3fc-2c963f66afa6" value={bookingId} onChange={event => setBookingId(event.target.value)} />
            </Field>
            <div className={styles.financeQuickLookupAction}>
              <Button type="submit" autoWidth>Mở khoản thu</Button>
            </div>
          </form>
          {error && <Notice title="Chưa tra cứu được" tone="error">{error}</Notice>}
        </Panel>}

        {selected && <section id="finance-selected-ledger" className={styles.financeDetailShell} aria-label={`Tài chính ${activeReference}`}>
          <div className={styles.financeDetailHeader}>
            <div className={styles.financeDetailIdentity}>
              <div className={styles.financeDetailTitleRow}>
                <h2 ref={selectedHeading} tabIndex={-1} className={styles.financeDetailHeading}>{activeReference}</h2>
                {activeStatus && <Badge label={bookingStatusName[activeStatus] ?? activeStatus} tone={bookingStatusTone[activeStatus] ?? 'neutral'} />}
              </div>
              <p className={styles.financeDetailMeta}>
                {activeCruiseName && <span>Chuyến: <strong>{activeCruiseName}</strong></span>}
                {activeFare != null && activeCurrency && <span>Tổng giá vé: <strong className={styles.numericCell}>{bookingMoney(activeFare, activeCurrency)}</strong></span>}
                <span className={styles.monoCode}>ID: {selected.id}</span>
              </p>
            </div>
            <div className={styles.formActions}>
              <Button tone="secondary" size="compact" autoWidth onClick={() => setSelected(null)}>Đóng hồ sơ</Button>
            </div>
          </div>

          <div className={styles.financeDetailGrid}>
            <div className={styles.financeDetailMain}>
              <PaymentLedger key={selected.id} bookingId={selected.id} currency={activeCurrency} onChanged={() => { detail.retry(); list.retry() }} />
              <RefundHistory key={selected.id + '-refunds'} bookingId={selected.id} />
            </div>
            {canBookings && <div className={styles.financeDetailSide}>
              <Panel title="Lịch thanh toán hợp đồng" subtitle="Đối chiếu số kỳ, hạn đóng và tình trạng hợp đồng.">
                <BookingReadState {...detail} />
                {detail.data && <BookingInstallments booking={detail.data} />}
                {detail.error instanceof ApiError && detail.error.status === 403 && <Notice title="Chưa truy cập được hợp đồng" tone="warning">Tài khoản chưa được phép đọc chi tiết đặt chỗ này. Bạn vẫn có thể tra cứu khoản thu bằng quyền thanh toán của mình.</Notice>}
              </Panel>
            </div>}
          </div>
        </section>}

        {canBookings && <Panel title="Danh sách đặt chỗ" subtitle="Chọn một đặt chỗ bên dưới để xem lịch thanh toán và thao tác thu tiền.">
          <BookingReadState {...list} />
          {list.data && <>
            {!list.data.content.length ? <Empty title="Chưa có đặt chỗ" /> : <DataTable label="Đặt chỗ và giá vé" headers={['Mã đặt chỗ', 'Tên chuyến', 'Trạng thái', 'Tổng giá vé', '']}>
              {list.data.content.map(item => {
                const isSelected = selectedId === item.bookingId
                return <tr key={item.bookingId} className={isSelected ? styles.selectedRow : undefined}>
                  <td className={styles.monoCode}>{item.bookingReference}</td>
                  <td>
                    {item.cruiseName}
                    {item.departureDatetime && <small>Khởi hành: {bookingWhen(item.departureDatetime)}</small>}
                  </td>
                  <td><Badge label={bookingStatusName[item.bookingStatus] ?? item.bookingStatus} tone={bookingStatusTone[item.bookingStatus] ?? 'neutral'} /></td>
                  <td className={styles.numericCell}>{item.agreedFareAmount != null && item.currency ? bookingMoney(item.agreedFareAmount, item.currency) : 'Chưa có'}</td>
                  <td>
                    <Button
                      tone={isSelected ? 'primary' : 'secondary'}
                      size="compact"
                      autoWidth
                      aria-controls="finance-selected-ledger"
                      aria-expanded={isSelected}
                      onClick={() => selectBooking({
                        id: item.bookingId,
                        reference: item.bookingReference,
                        currency: item.currency ?? '',
                        cruiseName: item.cruiseName,
                        status: item.bookingStatus,
                        fareAmount: item.agreedFareAmount,
                      })}
                    >{isSelected ? 'Đang mở' : 'Mở hồ sơ'}</Button>
                  </td>
                </tr>
              })}
            </DataTable>}
            <div className={styles.financePagination}>
              <Button tone="secondary" size="compact" autoWidth disabled={page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</Button>
              <span>Trang {page + 1} / {Math.max(1, list.data.totalPages)}</span>
              <Button tone="secondary" size="compact" autoWidth disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(value => value + 1)}>Trang sau →</Button>
            </div>
          </>}
        </Panel>}
      </div>}

      {canRefunds && activeTab === 'refunds' && <div
        id={`${baseId}-panel-refunds`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${baseId}-tab-refunds` : undefined}
        className={styles.financeTabPanel}
      >
        <CancellationQueue onInspectBooking={canPayments ? (targetId => {
          const known = list.data?.content.find(row => row.bookingId.toLowerCase() === targetId.toLowerCase())
          selectBooking({
            id: targetId,
            reference: known?.bookingReference ?? 'Đặt chỗ từ yêu cầu hủy',
            currency: known?.currency ?? '',
            cruiseName: known?.cruiseName,
            status: known?.bookingStatus,
            fareAmount: known?.agreedFareAmount,
          })
          setBookingId(targetId)
        }) : undefined} />
        <RefundSummary />
      </div>}

      {canRate && activeTab === 'rate' && <div
        id={`${baseId}-panel-rate`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${baseId}-tab-rate` : undefined}
        className={styles.financeTabPanel}
      >
        <UsdDisplayRate />
      </div>}
    </div>
  </RealBookingFrame>
}
