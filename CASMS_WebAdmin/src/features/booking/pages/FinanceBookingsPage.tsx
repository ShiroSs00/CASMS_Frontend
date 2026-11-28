import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CancellationQueue } from '@/shared/cancellation'
import { RefundHistory, RefundSummary } from '../components/RefundWorkspace'
import { UsdDisplayRate } from '../components/UsdDisplayRate'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Empty, Field, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { BookingInstallments } from '../components/BookingInstallments'
import { PaymentLedger } from '../components/PaymentLedger'
import { OnboardSettlement } from '../components/OnboardSettlement'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { BookingPaymentFacts } from '../components/BookingRecord'
import { SepayReconciliationPanel } from '../components/SepayReconciliationPanel'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName, bookingWhen } from '../model/real-booking-view'
import styles from '../components/LiveBooking.module.css'

type WorkspaceTab = 'payments' | 'reconciliation' | 'refunds' | 'rate'

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
    ...(canPayments ? [{ id: 'reconciliation' as const, label: 'Đối soát VietQR / SePay' }] : []),
    ...(canRefunds ? [{ id: 'refunds' as const, label: 'Hủy chỗ & hoàn tiền' }] : []),
    ...(canRate ? [{ id: 'rate' as const, label: 'Tỷ giá USD tham khảo' }] : []),
  ]
  const [requestedTab, setRequestedTab] = useState<WorkspaceTab>('payments')
  const activeTab: WorkspaceTab = tabs.some(tab => tab.id === requestedTab) ? requestedTab : (tabs[0]?.id ?? 'payments')
  const tabRefs = useRef<Partial<Record<WorkspaceTab, HTMLButtonElement | null>>>({})

  const [page, setPage] = useState(0)
  const [documentRevision, setDocumentRevision] = useState(0)
  const [selected, setSelected] = useState<{ id: string; reference: string; currency: string; cruiseName?: string; status?: string; fareAmount?: number | null } | null>(null)
  const [bookingId, setBookingId] = useState(''), [error, setError] = useState(''), [lookupBusy, setLookupBusy] = useState(false)
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

  async function openLedger(event: FormEvent) {
    event.preventDefault()
    if (!canPayments || lookupBusy) return
    const queryText = bookingId.trim()
    if (!queryText) {
      setError('Nhập mã đặt chỗ để tra cứu khoản thu.')
      return
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryText)
    const known = list.data?.content.find(row =>
      row.bookingId.toLowerCase() === queryText.toLowerCase()
      || row.bookingReference.toLowerCase() === queryText.toLowerCase()
    )
    if (known) {
      selectBooking({
        id: known.bookingId,
        reference: known.bookingReference,
        currency: known.currency ?? '',
        cruiseName: known.cruiseName,
        status: known.bookingStatus,
        fareAmount: known.agreedFareAmount,
      })
      return
    }
    if (!isUuid && canBookings) {
      setLookupBusy(true)
      setError('')
      try {
        const normalized = queryText.toLowerCase()
        const maxPages = Math.max(1, list.data?.totalPages ?? 1)
        const pagesToFetch = Array.from({ length: maxPages }, (_, idx) => idx).filter(p => !(p === page && list.data))
        const results = await Promise.all(
          pagesToFetch.map(p => realBookingApi.list(p, undefined, undefined)),
        )
        const exact = results.flatMap(r => r.content).find(row =>
          row.bookingReference.toLowerCase() === normalized
          || row.bookingId.toLowerCase() === normalized,
        )
        if (exact) {
          selectBooking({
            id: exact.bookingId,
            reference: exact.bookingReference,
            currency: exact.currency ?? '',
            cruiseName: exact.cruiseName,
            status: exact.bookingStatus,
            fareAmount: exact.agreedFareAmount,
          })
          return
        }
        setError(`Không tìm thấy đặt chỗ với mã “${queryText}”. Kiểm tra lại mã đặt chỗ hoặc chọn trực tiếp từ danh sách bên dưới.`)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Chưa tra cứu được đặt chỗ. Vui lòng thử lại.')
      } finally {
        setLookupBusy(false)
      }
      return
    }
    if (!isUuid) {
      setError('Nhập mã đặt chỗ chính xác hoặc ID đặt chỗ hợp lệ.')
      return
    }
    selectBooking({
      id: queryText,
      reference: 'Đặt chỗ được tra cứu',
      currency: '',
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

  return <RealBookingFrame>
    <PageHeader
      breadcrumb="TÀI CHÍNH"
      title="Thu tiền và đối soát"
      description=""
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
        {canPayments && !selected && <Panel title="Tra cứu khoản thu theo đặt chỗ">
          <form className={styles.financeQuickLookupForm} noValidate onSubmit={event => void openLedger(event)}>
            <Field htmlFor="finance-booking-id" label="Mã đặt chỗ *" error={error || undefined}>
              <input id="finance-booking-id" required placeholder="Ví dụ: DEMO-PAY-01" value={bookingId} disabled={lookupBusy} onChange={event => { setBookingId(event.target.value); if (error) setError('') }} />
            </Field>
            <div className={styles.financeQuickLookupAction}>
              <Button type="submit" autoWidth busy={lookupBusy}>{lookupBusy ? 'Đang tìm…' : 'Mở khoản thu'}</Button>
            </div>
          </form>
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
              </p>
            </div>
            <div className={styles.formActions}>
              <Button tone="secondary" size="compact" autoWidth onClick={() => setSelected(null)}>Về danh sách khoản thu</Button>
            </div>
          </div>

          <BookingReadState {...detail} />
          {detail.data && <BookingPaymentFacts booking={detail.data} />}
          <div className={styles.financeDetailGrid}>
            <div className={styles.financeDetailMain}>
              <PaymentLedger
                key={selected.id}
                bookingId={selected.id}
                currency={activeCurrency}
                bookingTotalPaid={detail.data?.totalPaidAmount}
                bookingOutstanding={detail.data?.outstandingBalance}
                onChanged={() => { detail.retry(); list.retry() }}
              />
            </div>
            {canBookings && <div className={styles.financeDetailSide}>
              <Panel title="Lịch thanh toán hợp đồng">
                <BookingReadState {...detail} />
                {detail.data && <BookingInstallments booking={detail.data} />}
                {detail.error instanceof ApiError && detail.error.status === 403 && <Notice title="Chưa truy cập được hợp đồng" tone="warning">Tài khoản chưa được phép đọc chi tiết đặt chỗ này. Bạn vẫn có thể tra cứu khoản thu bằng quyền thanh toán của mình.</Notice>}
              </Panel>
            </div>}
          </div>
          <div className={styles.financeDetailMain}>
            <BookingInvoiceSettlementPanel key={selected.id + '-invoice-' + documentRevision} bookingId={selected.id} bookingReference={activeReference} amount={detail.data?.agreedFareAmount} currency={activeCurrency} />
            <OnboardSettlement key={selected.id + '-settlement'} bookingId={selected.id} />
            <RefundHistory key={selected.id + '-refunds'} bookingId={selected.id} onChanged={() => { setDocumentRevision(value => value + 1); detail.retry() }} />
          </div>
        </section>}

        {canBookings && !selected && <Panel title="Chọn đặt chỗ để kiểm tra khoản thu">
          <BookingReadState {...list} />
          {list.data && <>
            {!list.data.content.length ? <Empty title="Chưa có đặt chỗ" /> : <DataTable label="Đặt chỗ và giá vé" headers={['Mã đặt chỗ', 'Tên chuyến', 'Trạng thái', 'Tổng giá vé', 'Thao tác']}>
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

      {canPayments && activeTab === 'reconciliation' && <div
        id={`${baseId}-panel-reconciliation`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${baseId}-tab-reconciliation` : undefined}
        className={styles.financeTabPanel}
      >
        <SepayReconciliationPanel
          onInspectBooking={targetId => {
            const known = list.data?.content.find(row => row.bookingId.toLowerCase() === targetId.toLowerCase())
            selectBooking({
              id: targetId,
              reference: known?.bookingReference ?? 'Đặt chỗ từ đối soát SePay',
              currency: known?.currency ?? '',
              cruiseName: known?.cruiseName,
              status: known?.bookingStatus,
              fareAmount: known?.agreedFareAmount,
            })
            setBookingId(targetId)
          }}
          onMutated={() => {
            detail.retry()
            list.retry()
          }}
        />
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

type BookingInvoiceRow = {
  invoiceId: string
  invoiceReference?: string | null
  versionNo?: number | null
  documentType?: string | null
  status?: string | null
  snapshotTotalAmount?: number | null
  currency?: string | null
  issuedAt?: string | null
  lines?: { invoiceLineId: string; lineNo: number; descriptionSnapshot: string; quantitySnapshot: number; baseAmountSnapshot: number; taxAmountSnapshot: number; totalAmountSnapshot: number }[]
}

function BookingInvoiceSettlementPanel({ bookingId, bookingReference, amount, currency }: { bookingId: string; bookingReference: string; amount?: number; currency: string }) {
  const access = useSessionAccess()
  const canReadInvoices = access.status === 'ready' && (access.has('PAYMENT_READ') || access.has('INVOICE_GENERATE'))
  const canGenerateInvoice = access.status === 'ready' && (access.has('INVOICE_GENERATE') || access.has('PAYMENT_PROCESS'))
  const invoices = useReadQuery(
    `finance-invoices:${access.userId}:${bookingId}:${canReadInvoices}`,
    useCallback(
      (signal: AbortSignal) => (canReadInvoices ? apiRequest<BookingInvoiceRow[]>(`/invoices/booking/${encodeURIComponent(bookingId)}`, { signal }) : Promise.resolve(null)),
      [canReadInvoices, bookingId],
    ),
  )
  const [busy, setBusy] = useState<'invoice' | null>(null)
  const lock = useRef(false)
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const recoveryKey = `invoice-pending:${access.userId}:${bookingId}`
  const [unknownVersion, setUnknownVersion] = useState<number | null>(() => {
    try { const value = sessionStorage.getItem(recoveryKey); return value === null ? null : /^\d+$/.test(value) ? Number(value) : -1 } catch { return -1 }
  })
  const latestVersion = invoices.data?.reduce((version, invoice) => Math.max(version, invoice.versionNo ?? 0), 0) ?? 0
  const inspectedInvoice = invoices.data?.find(invoice => invoice.invoiceId === expandedInvoice)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  if (!canReadInvoices && !canGenerateInvoice) return null

  async function generateInvoice() {
    if (lock.current || unknownVersion !== null || invoices.loading || invoices.error || !canGenerateInvoice) return
    lock.current = true
    setBusy('invoice'); setFeedback(null)
    try {
      sessionStorage.setItem(recoveryKey, String(latestVersion))
      const created = await apiRequest<BookingInvoiceRow>(`/invoices/booking/${encodeURIComponent(bookingId)}`, { method: 'POST', ifMatch: latestVersion })
      sessionStorage.removeItem(recoveryKey)
      setFeedback({ tone: 'success', message: created.invoiceReference ? `Đã lập chứng từ ${created.invoiceReference}.` : 'Đã lập chứng từ. Kiểm tra trạng thái phát hành trong danh sách.' })
      setIssuing(false)
      invoices.retry()
    } catch (err) {
      if (mutationOutcomeUnknown(err)) setUnknownVersion(latestVersion)
      else { try { sessionStorage.removeItem(recoveryKey) } catch { setUnknownVersion(-1) } }
      if (err instanceof ApiError && err.status === 409) { setIssuing(false); invoices.retry() }
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Chưa phát hành được hóa đơn.' })
    } finally {
      lock.current = false
      setBusy(null)
    }
  }

  return (
    <Panel id="finance-booking-invoices" title="Hóa đơn đặt chỗ">
      <div className={styles.formActions}>
        {canGenerateInvoice && (
          <Button size="compact" autoWidth busy={busy === 'invoice'} disabled={unknownVersion !== null || busy !== null || invoices.loading || Boolean(invoices.error)} onClick={() => setIssuing(true)}>
            {invoices.data?.length ? 'Phát hành phiên bản hóa đơn mới' : 'Xuất hóa đơn đặt chỗ'}
          </Button>
        )}
      </div>
      {unknownVersion !== null && <Notice tone="warning" title="Chưa xác nhận được kết quả phát hành">
        <p>Kiểm tra lại chứng từ trước khi phát hành tiếp để tránh tạo thêm phiên bản ngoài ý muốn.</p>
        <Button tone="secondary" disabled={Boolean(busy)} onClick={invoices.retry}>Tải lại danh sách chứng từ</Button>
        {unknownVersion >= 0 && latestVersion > unknownVersion && <Button tone="secondary" onClick={() => { try { sessionStorage.removeItem(recoveryKey); setUnknownVersion(null); setIssuing(false) } catch { setFeedback({ tone: 'error', message: 'Chưa lưu được kết quả đối chiếu trên trình duyệt.' }) } }}>Đã đối chiếu phiên bản {latestVersion}</Button>}
      </Notice>}
      {feedback && <Notice title={feedback.tone === 'success' ? 'Đã cập nhật' : 'Chưa thể thực hiện'} tone={feedback.tone}>{feedback.message}</Notice>}
      {invoices.loading && <p role="status">Đang tải danh sách hóa đơn…</p>}
      {invoices.error && <Notice title="Chưa tải được danh sách hóa đơn" tone="error"><Button tone="secondary" size="compact" autoWidth onClick={invoices.retry}>Tải lại</Button></Notice>}
      {invoices.data && (invoices.data.length > 0 ? (
        <DataTable label="Hóa đơn của đặt chỗ" headers={['Số hóa đơn', 'Loại chứng từ', 'Trạng thái', 'Tổng tiền', 'Ngày phát hành', 'Nội dung']}>
          {invoices.data.map(inv => (
            <tr key={inv.invoiceId}>
              <td className={styles.monoCode}>{inv.invoiceReference ?? 'Chưa có số chứng từ'}{inv.versionNo != null && <small>Phiên bản {inv.versionNo}</small>}</td>
              <td>{({ BookingInvoice: 'Hóa đơn đặt chỗ', PreliminaryFolio: 'Bảng kê tạm tính', FinalStatement: 'Bảng quyết toán', AdjustmentStatement: 'Chứng từ điều chỉnh' } as Record<string, string>)[inv.documentType ?? ''] ?? 'Chưa xác định'}</td>
              <td>{({ Draft: 'Bản nháp', Issued: 'Đã phát hành', Superseded: 'Đã được thay thế', Voided: 'Đã hủy hiệu lực' } as Record<string, string>)[inv.status ?? ''] ?? 'Chưa có trạng thái phát hành'}</td>
              <td className={styles.numericCell}>{inv.snapshotTotalAmount != null && inv.currency ? bookingMoney(inv.snapshotTotalAmount, inv.currency) : 'Chưa có số tiền'}</td>
              <td>{inv.issuedAt ? bookingWhen(inv.issuedAt) : '—'}</td>
              <td><Button tone="text" size="compact" autoWidth aria-expanded={expandedInvoice === inv.invoiceId} onClick={() => setExpandedInvoice(expandedInvoice === inv.invoiceId ? null : inv.invoiceId)}>{expandedInvoice === inv.invoiceId ? 'Đóng chi tiết' : 'Xem chứng từ'}</Button></td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <p className={styles.helper}>Chưa có hóa đơn nào được phát hành cho đặt chỗ này.</p>
      ))}
      {inspectedInvoice && <section aria-label={`Nội dung ${inspectedInvoice.invoiceReference ?? 'chứng từ'}`}>
        <h3>{inspectedInvoice.invoiceReference ?? 'Nội dung chứng từ'}</h3>
        {inspectedInvoice.lines?.length ? <DataTable label="Chi tiết chứng từ" headers={['Nội dung', 'Số lượng', 'Trước thuế', 'Thuế', 'Thành tiền']}>
          {inspectedInvoice.lines.map(line => <tr key={line.invoiceLineId}><td>{line.descriptionSnapshot}</td><td className={styles.numericCell}>{line.quantitySnapshot}</td><td className={styles.numericCell}>{inspectedInvoice.currency && line.baseAmountSnapshot != null ? bookingMoney(line.baseAmountSnapshot, inspectedInvoice.currency) : 'Chưa có'}</td><td className={styles.numericCell}>{inspectedInvoice.currency && line.taxAmountSnapshot != null ? bookingMoney(line.taxAmountSnapshot, inspectedInvoice.currency) : 'Chưa có'}</td><td className={styles.numericCell}>{inspectedInvoice.currency && line.totalAmountSnapshot != null ? bookingMoney(line.totalAmountSnapshot, inspectedInvoice.currency) : 'Chưa có'}</td></tr>)}
        </DataTable> : <p>Chứng từ chưa có chi tiết khoản mục.</p>}
      </section>}
      {issuing && unknownVersion === null && <Modal title={invoices.data?.length ? 'Phát hành phiên bản hóa đơn mới' : 'Phát hành hóa đơn đặt chỗ'} busy={busy !== null} onClose={() => { if (!busy) setIssuing(false) }} footer={<><Button tone="secondary" disabled={Boolean(busy)} onClick={() => setIssuing(false)}>Quay lại</Button><Button busy={Boolean(busy)} onClick={() => void generateInvoice()}>Phát hành chứng từ</Button></>}>
        <p><strong>{bookingReference}</strong>{amount != null && currency ? ` · ${bookingMoney(amount, currency)}` : ''}</p>
        <p>Hệ thống phát hành chứng từ theo giá trị đặt chỗ đang được lưu. Chứng từ mới không xác nhận đã thu tiền.</p>
        {!!invoices.data?.length && <p>Hóa đơn hiện có được giữ trong lịch sử; thao tác này lập thêm phiên bản mới.</p>}
        {feedback?.tone === 'error' && <Notice tone="error" title="Chưa phát hành được hóa đơn">{feedback.message}</Notice>}
      </Modal>}
    </Panel>
  )
}
