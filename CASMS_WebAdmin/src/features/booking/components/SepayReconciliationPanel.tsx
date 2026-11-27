import { useCallback, useId, useRef, useState, type FormEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Empty, Field, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import {
  sepayReconciliationApi,
  type SepayReconciliationAction,
  type SepayReconciliationStatus,
  type SepayTransaction,
  type SepayTransactionStatus,
} from '../api/payment-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName, bookingWhen } from '../model/real-booking-view'
import {
  sepayExceptionCodeLabels,
  sepayReconciliationActionLabels,
  sepayReconciliationStatusLabels,
  sepayTxStatusLabels,
} from '../model/experience-copy'
import { BookingReadState } from './RealBookingUI'
import styles from './LiveBooking.module.css'

type FilterPreset = 'PENDING_REVIEW' | 'RETRY_REQUIRED' | 'PROCESSED' | 'RESOLVED' | 'ALL'

const txStatusTone: Record<SepayTransactionStatus, 'neutral' | 'info' | 'warning' | 'error' | 'success'> = {
  RECEIVED: 'info',
  PROCESSED: 'success',
  RETRY_REQUIRED: 'error',
  UNMATCHED: 'warning',
  AMOUNT_MISMATCH: 'error',
  RECONCILIATION_REQUIRED: 'warning',
  IGNORED: 'neutral',
}

const reconStatusTone: Record<SepayReconciliationStatus, 'neutral' | 'warning' | 'success'> = {
  NONE: 'neutral',
  PENDING_REVIEW: 'warning',
  RESOLVED: 'success',
}

const auditActionLabels: Record<string, string> = {
  WEBHOOK_RECEIVED: 'Tiếp nhận sự kiện SePay',
  AUTO_POSTED: 'Tự động khớp & ghi sổ',
  MARKED_EXCEPTION: 'Phát hiện ngoại lệ cần đối soát',
  POSTING_FAILED_RETRYABLE: 'Lỗi tạm thời khi ghi sổ',
  RETRY_SUCCEEDED: 'Phục hồi ghi sổ thành công',
  IGNORED_NON_INCOMING: 'Bỏ qua giao dịch tiền ra',
  ...sepayReconciliationActionLabels,
}

function formatVariance(variance: number | null, currency: string): string {
  if (variance == null) return '—'
  if (variance === 0) return bookingMoney(0, currency)
  const prefix = variance > 0 ? '+' : '−'
  return `${prefix}${bookingMoney(Math.abs(variance), currency)}`
}

export function SepayReconciliationPanel({
  onInspectBooking,
  onMutated,
}: {
  onInspectBooking?: (bookingId: string) => void
  onMutated?: () => void
}) {
  const access = useSessionAccess()
  const baseId = useId()
  const canRead = access.canDo('PAYMENT_REPORT') || access.canDo('PAYMENT_PROCESS')
  const canResolve = access.canDo('PAYMENT_PROCESS')

  const [preset, setPreset] = useState<FilterPreset>('PENDING_REVIEW')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const listQuery = useReadQuery(
    `sepay-recon:${access.userId}:${preset}:${appliedSearch}:${page}:${canRead}`,
    useCallback(
      signal =>
        canRead
          ? sepayReconciliationApi.list(
              {
                status: (preset === 'RETRY_REQUIRED' ? 'RETRY_REQUIRED' : preset === 'PROCESSED' ? 'PROCESSED' : '') as SepayTransactionStatus | '',
                reconciliationStatus: (preset === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : preset === 'RESOLVED' ? 'RESOLVED' : '') as SepayReconciliationStatus | '',
                search: appliedSearch,
                page,
                size: 20,
              },
              signal,
            )
          : Promise.resolve(null),
      [canRead, preset, appliedSearch, page],
    ),
  )

  const detailQuery = useReadQuery(
    `sepay-recon-detail:${access.userId}:${selectedId ?? ''}`,
    useCallback(
      signal => (canRead && selectedId ? sepayReconciliationApi.detail(selectedId, signal) : Promise.resolve(null)),
      [canRead, selectedId],
    ),
  )

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setPage(0)
    setAppliedSearch(searchInput.trim())
  }

  function handleResolved() {
    listQuery.retry()
    detailQuery.retry()
    onMutated?.()
  }

  if (!canRead) {
    return (
      <Notice title="Chưa có quyền xem đối soát SePay" tone="warning">
        Tài khoản cần quyền báo cáo hoặc xử lý thanh toán của bộ phận Tài chính để đối soát giao dịch VietQR.
      </Notice>
    )
  }

  const data = listQuery.data

  return (
    <div className={styles.stack}>
      <Panel
        title="Đối soát giao dịch VietQR / SePay"
        subtitle=""
      >
        <div className={styles.financeToolbar}>
          <div className={styles.financeToolbarStats}>
            <span>
              Chờ Tài chính đối soát: <strong>{data?.pendingReviewCount ?? 0}</strong>
            </span>
            <span>
              Cần thử ghi sổ lại: <strong>{data?.retryRequiredCount ?? 0}</strong>
            </span>
            <span>
              Đang hiển thị: <strong>{data?.totalElements ?? 0}</strong> giao dịch
            </span>
          </div>
          <Button tone="secondary" size="compact" autoWidth disabled={listQuery.loading} onClick={listQuery.retry}>
            Tải lại danh sách
          </Button>
        </div>

        <form className={styles.reconFilterBar} noValidate onSubmit={submitSearch}>
          <Field htmlFor={`${baseId}-preset`} label="Nhóm giao dịch">
            <select
              id={`${baseId}-preset`}
              value={preset}
              onChange={event => {
                setPreset(event.target.value as FilterPreset)
                setPage(0)
              }}
            >
              <option value="PENDING_REVIEW">Chờ đối soát (ngoại lệ)</option>
              <option value="RETRY_REQUIRED">Lỗi tạm thời cần xử lý lại</option>
              <option value="ALL">Tất cả giao dịch SePay</option>
              <option value="PROCESSED">Đã ghi sổ thành công</option>
              <option value="RESOLVED">Đã đối soát hoàn tất</option>
            </select>
          </Field>
          <Field htmlFor={`${baseId}-search`} label="Tìm theo mã đặt chỗ, nội dung CK hoặc tham chiếu ngân hàng">
            <input
              id={`${baseId}-search`}
              placeholder="Ví dụ: BK-0001, CASMS, FT26..."
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
            />
          </Field>
          <div className={styles.reconFilterActions}>
            <Button type="submit" size="compact" autoWidth>
              Lọc
            </Button>
            {(appliedSearch || searchInput || preset !== 'PENDING_REVIEW') && (
              <Button
                tone="secondary"
                size="compact"
                autoWidth
                onClick={() => {
                  setPreset('PENDING_REVIEW')
                  setSearchInput('')
                  setAppliedSearch('')
                  setPage(0)
                }}
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </form>

        <BookingReadState {...listQuery} />

        {data && !listQuery.loading && !listQuery.error && (
          data.content.length === 0 ? (
            <Empty title="Không có giao dịch trong nhóm này">
              <p>
                {preset === 'PENDING_REVIEW'
                  ? 'Hiện không có giao dịch VietQR sai lệch nào đang chờ Tài chính xử lý.'
                  : 'Thử chuyển nhóm lọc hoặc thay đổi từ khóa tìm kiếm.'}
              </p>
            </Empty>
          ) : (
            <>
              <DataTable
                label="Danh sách giao dịch SePay và đối soát"
                headers={[
                  'Thời gian',
                  'Giao dịch & nội dung',
                  'Đặt chỗ',
                  'Dự kiến',
                  'Thực nhận / Lệch',
                  'Trạng thái & lý do',
                  'Thao tác',
                ]}
              >
                {data.content.map(tx => (
                  <tr key={tx.id}>
                    <td className={styles.reconNoWrap}>
                      <div>{bookingWhen(tx.transactionDate ?? tx.createdAt)}</div>
                      <small>{tx.gateway ?? 'SePay'}</small>
                    </td>
                    <td className={styles.reconMemoCell}>
                      <div className={styles.monoCode}>{tx.content || tx.code || '—'}</div>
                      <small>
                        {tx.referenceCode || `SEPAY-${tx.sepayId}`} · #{tx.sepayId}
                        {tx.accountNumber ? ` · TK ${tx.accountNumber}` : ''}
                      </small>
                    </td>
                    <td className={styles.reconNoWrap}>
                      {tx.bookingReference ? (
                        <div>
                          <span className={styles.monoCode}>{tx.bookingReference}</span>
                          {tx.bookingStatus && (
                            <small>{bookingStatusName[tx.bookingStatus] ?? tx.bookingStatus}</small>
                          )}
                        </div>
                      ) : (
                        <span className={styles.helper}>Chưa gắn đặt chỗ</span>
                      )}
                    </td>
                    <td className={`${styles.numericCell} ${styles.reconNoWrap}`}>
                      {tx.expectedAmount == null ? '—' : bookingMoney(tx.expectedAmount, tx.currency)}
                    </td>
                    <td className={`${styles.numericCell} ${styles.reconNoWrap}`}>
                      <div>
                        <strong>{bookingMoney(tx.transferAmount, tx.currency)}</strong>
                      </div>
                      {tx.varianceAmount != null && tx.varianceAmount !== 0 && (
                        <small>Lệch: {formatVariance(tx.varianceAmount, tx.currency)}</small>
                      )}
                    </td>
                    <td className={styles.reconStatusCell}>
                      <div className={styles.reconBadgeStack}>
                        <Badge label={sepayTxStatusLabels[tx.status]} tone={txStatusTone[tx.status]} />
                        {tx.reconciliationStatus !== 'NONE' && (
                          <Badge
                            label={sepayReconciliationStatusLabels[tx.reconciliationStatus]}
                            tone={reconStatusTone[tx.reconciliationStatus]}
                          />
                        )}
                      </div>
                      {tx.exceptionCode && (
                        <small>{sepayExceptionCodeLabels[tx.exceptionCode] ?? tx.exceptionCode}</small>
                      )}
                    </td>
                    <td className={styles.reconActionCell}>
                      <Button
                        tone={tx.reconciliationStatus === 'PENDING_REVIEW' || tx.status === 'RETRY_REQUIRED' ? 'primary' : 'secondary'}
                        size="compact"
                        autoWidth
                        onClick={() => setSelectedId(tx.id)}
                      >
                        {tx.reconciliationStatus === 'PENDING_REVIEW'
                          ? 'Đối soát'
                          : tx.status === 'RETRY_REQUIRED'
                            ? 'Xử lý lại'
                            : 'Chi tiết'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>

              {data.totalPages > 1 && (
                <div className={styles.financePagination}>
                  <Button
                    tone="secondary"
                    size="compact"
                    autoWidth
                    disabled={page === 0}
                    onClick={() => setPage(v => Math.max(0, v - 1))}
                  >
                    Trang trước
                  </Button>
                  <span>
                    Trang {page + 1} / {data.totalPages}
                  </span>
                  <Button
                    tone="secondary"
                    size="compact"
                    autoWidth
                    disabled={page + 1 >= data.totalPages}
                    onClick={() => setPage(v => v + 1)}
                  >
                    Trang sau →
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </Panel>

      {selectedId && (
        <ReconciliationDetailModal
          transaction={detailQuery.data}
          loading={detailQuery.loading}
          error={detailQuery.error}
          canResolve={canResolve}
          onClose={() => setSelectedId(null)}
          onReload={detailQuery.retry}
          onResolved={handleResolved}
          onInspectBooking={onInspectBooking}
        />
      )}
    </div>
  )
}

function ReconciliationDetailModal({
  transaction,
  loading,
  error,
  canResolve,
  onClose,
  onReload,
  onResolved,
  onInspectBooking,
}: {
  transaction: SepayTransaction | null
  loading: boolean
  error: unknown
  canResolve: boolean
  onClose: () => void
  onReload: () => void
  onResolved: () => void
  onInspectBooking?: (bookingId: string) => void
}) {
  const [action, setAction] = useState<SepayReconciliationAction>('MARK_FOR_REFUND')
  const [evidenceRef, setEvidenceRef] = useState('')
  const [reason, setReason] = useState('')
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const lock = useRef(false)
  const effectiveTargetBookingId = targetBookingId ?? (transaction?.bookingId ?? '')

  const canShowResolveForm =
    canResolve
    && transaction != null
    && transaction.reconciliationStatus !== 'RESOLVED'
    && transaction.status !== 'PROCESSED'
    && transaction.status !== 'IGNORED'

  const canShowRetry =
    canResolve
    && transaction != null
    && (transaction.status === 'RETRY_REQUIRED' || transaction.status === 'RECEIVED')

  async function submitResolve(event: FormEvent) {
    event.preventDefault()
    if (!transaction || !canShowResolveForm || lock.current) return
    if (!evidenceRef.trim() || !reason.trim()) {
      setActionError('Cần nhập đầy đủ mã chứng từ đối chiếu và lý do xử lý.')
      return
    }
    const resolvedBookingId = effectiveTargetBookingId.trim()
    if (action === 'APPLY_TO_BOOKING' && !resolvedBookingId) {
      setActionError('Cần nhập mã định danh đặt chỗ hợp lệ khi chọn Ghi nhận vào đặt chỗ.')
      return
    }
    lock.current = true
    setBusy(true)
    setActionError('')
    setActionSuccess('')
    try {
      await sepayReconciliationApi.resolve(transaction.id, {
        action,
        evidenceReference: evidenceRef.trim(),
        reason: reason.trim(),
        targetBookingId: resolvedBookingId || undefined,
      })
      setActionSuccess('Đã ghi nhận kết quả đối soát và lưu nhật ký kiểm toán.')
      setEvidenceRef('')
      setReason('')
      onResolved()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Chưa lưu được kết quả đối soát.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function runRetry() {
    if (!transaction || !canShowRetry || lock.current) return
    lock.current = true
    setBusy(true)
    setActionError('')
    setActionSuccess('')
    try {
      await sepayReconciliationApi.retry(transaction.id)
      setActionSuccess('Đã thử ghi sổ lại giao dịch SePay.')
      onResolved()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Chưa thể thử ghi sổ lại giao dịch.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      title={transaction ? `Đối soát giao dịch SePay #${transaction.sepayId}` : 'Chi tiết giao dịch SePay'}
      busy={busy}
      onClose={onClose}
      footer={
        <Button tone="secondary" autoWidth disabled={busy} onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {loading && <p role="status">Đang tải chi tiết giao dịch và lịch sử xử lý…</p>}
      {Boolean(error) && (
        <Notice title="Chưa tải được chi tiết giao dịch" tone="error">
          {error instanceof Error ? error.message : 'Vui lòng thử tải lại.'}{' '}
          <Button tone="text" autoWidth onClick={onReload}>
            Tải lại
          </Button>
        </Notice>
      )}
      {transaction && (
        <div className={styles.stack}>
          <div className={styles.reconBadgeStack}>
            <Badge label={sepayTxStatusLabels[transaction.status]} tone={txStatusTone[transaction.status]} />
            {transaction.reconciliationStatus !== 'NONE' && (
              <Badge
                label={sepayReconciliationStatusLabels[transaction.reconciliationStatus]}
                tone={reconStatusTone[transaction.reconciliationStatus]}
              />
            )}
          </div>

          {transaction.exceptionReason && (
            <Notice
              title={
                transaction.exceptionCode
                  ? (sepayExceptionCodeLabels[transaction.exceptionCode] ?? 'Ngoại lệ cần đối soát')
                  : 'Ngoại lệ cần đối soát'
              }
              tone={transaction.reconciliationStatus === 'RESOLVED' ? 'info' : 'warning'}
            >
              {transaction.exceptionReason}
            </Notice>
          )}

          {transaction.lastError && (
            <Notice title="Lỗi ghi sổ gần nhất" tone="error">
              {transaction.lastError} (Số lần thử: {transaction.retryCount})
            </Notice>
          )}

          <RecordFacts
            entries={[
              ['Mã giao dịch SePay', String(transaction.sepayId)],
              ['Tham chiếu ngân hàng', transaction.referenceCode ?? 'Chưa có'],
              ['Ngân hàng / Cổng', transaction.gateway ?? 'SePay'],
              ['Tài khoản nhận', transaction.accountNumber ?? 'Chưa có'],
              ['Nội dung chuyển khoản', transaction.content ?? 'Chưa có'],
              ['Thời gian ngân hàng', bookingWhen(transaction.transactionDate ?? transaction.createdAt)],
              [
                'Số tiền dự kiến',
                transaction.expectedAmount == null
                  ? 'Chưa xác định'
                  : bookingMoney(transaction.expectedAmount, transaction.currency),
              ],
              ['Số tiền thực nhận', bookingMoney(transaction.transferAmount, transaction.currency)],
              ['Chênh lệch', formatVariance(transaction.varianceAmount, transaction.currency)],
              [
                'Đặt chỗ liên quan',
                transaction.bookingReference
                  ? `${transaction.bookingReference} (${bookingStatusName[transaction.bookingStatus ?? ''] ?? transaction.bookingStatus ?? ''})`
                  : 'Chưa gắn đặt chỗ',
              ],
              ['Mã lệnh đối soát gốc', transaction.paymentReceiptReference ?? 'Không có'],
              ['Thời điểm ghi sổ', transaction.postedAt ? bookingWhen(transaction.postedAt) : 'Chưa ghi sổ'],
            ]}
          />

          {transaction.bookingId && onInspectBooking && (
            <div className={styles.formActions}>
              <Button
                tone="secondary"
                size="compact"
                autoWidth
                onClick={() => {
                  onInspectBooking(transaction.bookingId!)
                  onClose()
                }}
              >
                Mở hồ sơ đặt chỗ {transaction.bookingReference ?? ''}
              </Button>
            </div>
          )}

          {transaction.reconciliationStatus === 'RESOLVED' && (
            <Notice title="Kết quả đối soát đã chốt" tone="success">
              <p>
                <strong>Hành động:</strong>{' '}
                {transaction.reconciliationAction
                  ? sepayReconciliationActionLabels[transaction.reconciliationAction]
                  : 'Đã xử lý'}
              </p>
              <p>
                <strong>Người thực hiện:</strong> {transaction.reconciledByUsername ?? '—'} ·{' '}
                {transaction.reconciledAt ? bookingWhen(transaction.reconciledAt) : ''}
              </p>
              <p>
                <strong>Chứng từ:</strong> {transaction.reconciliationEvidenceRef ?? '—'}
              </p>
              <p>
                <strong>Lý do:</strong> {transaction.reconciliationReason ?? '—'}
              </p>
            </Notice>
          )}

          {actionSuccess && (
            <Notice title="Đã cập nhật đối soát" tone="success">
              {actionSuccess}
            </Notice>
          )}
          {actionError && (
            <Notice title="Chưa thể thực hiện" tone="error">
              {actionError}
            </Notice>
          )}

          {canShowRetry && (
            <div className={styles.financeFormSection}>
              <h3 className={styles.financeSubheading}>Phục hồi sự kiện lỗi tạm thời</h3>
              <p className={styles.helper}>
                Sự kiện đã được lưu an toàn theo ID giao dịch SePay. Bấm thử ghi sổ lại để chạy lại bước đối chiếu và
                cập nhật công nợ mà không nhân đôi số tiền.
              </p>
              <div className={styles.formActions}>
                <Button autoWidth busy={busy} onClick={() => void runRetry()}>
                  Thử ghi sổ lại giao dịch
                </Button>
              </div>
            </div>
          )}

          {canShowResolveForm && (
            <form className={styles.financeFormSection} noValidate onSubmit={submitResolve}>
              <h3 className={styles.financeSubheading}>Ghi nhận kết quả đối soát (Tài chính)</h3>
              <Field htmlFor="recon-action" label="Hướng xử lý đối soát *">
                <select
                  id="recon-action"
                  value={action}
                  disabled={busy}
                  onChange={event => setAction(event.target.value as SepayReconciliationAction)}
                >
                  <option value="MARK_FOR_REFUND">Chuyển quy trình hoàn tiền (dư tiền / trùng / đơn đã hủy hoặc hết hạn)</option>
                  <option value="APPLY_TO_BOOKING">Ghi nhận vào đặt chỗ hợp lệ (khi đã đối chiếu chứng từ)</option>
                  <option value="MANUAL_RESOLVED">Đóng đối soát thủ công (đã xử lý theo biên bản)</option>
                  <option value="DISMISSED">Không thuộc khoản thu đặt chỗ</option>
                </select>
              </Field>
              {action === 'APPLY_TO_BOOKING' && (
                <Field
                  htmlFor="recon-booking-id"
                  label="Mã định danh đặt chỗ cần ghi nhận *"
                  hint={
                    transaction.bookingId
                      ? `Mặc định gắn vào ${transaction.bookingReference ?? transaction.bookingId}. Chỉ đổi nếu khách ghi sai mã đặt chỗ.`
                      : 'Nhập mã định danh đặt chỗ cần ghi nhận khoản tiền thực nhận.'
                  }
                >
                  <input
                    id="recon-booking-id"
                    value={effectiveTargetBookingId}
                    disabled={busy}
                    onChange={event => setTargetBookingId(event.target.value)}
                  />
                </Field>
              )}
              <Field
                htmlFor="recon-evidence"
                label="Mã chứng từ / sao kê ngân hàng *"
                hint="Bắt buộc lưu mã chứng từ đối chiếu phục vụ kiểm toán."
              >
                <input
                  id="recon-evidence"
                  required
                  maxLength={255}
                  placeholder="Ví dụ: SAOKEN-MB-20261120-01"
                  value={evidenceRef}
                  disabled={busy}
                  onChange={event => setEvidenceRef(event.target.value)}
                />
              </Field>
              <Field htmlFor="recon-reason" label="Lý do & ghi chú đối soát *">
                <textarea
                  id="recon-reason"
                  required
                  maxLength={1000}
                  rows={3}
                  placeholder="Ghi rõ căn cứ đối chiếu và hướng xử lý với khách hàng..."
                  value={reason}
                  disabled={busy}
                  onChange={event => setReason(event.target.value)}
                />
              </Field>
              <div className={styles.formActions}>
                <Button type="submit" autoWidth busy={busy}>
                  Xác nhận kết quả đối soát
                </Button>
              </div>
            </form>
          )}

          {transaction.auditHistory && transaction.auditHistory.length > 0 && (
            <div className={styles.financeFormSection}>
              <h3 className={styles.financeSubheading}>Lịch sử xử lý (Kiểm toán)</h3>
              <ol className={styles.reconAuditList}>
                {transaction.auditHistory.map(entry => (
                  <li key={entry.id}>
                    <div className={styles.reconAuditHeader}>
                      <strong>{auditActionLabels[entry.action] ?? entry.action}</strong>
                      <span>{bookingWhen(entry.createdAt)}</span>
                    </div>
                    <p className={styles.helper}>
                      Người thực hiện: {entry.actorUsername === 'SYSTEM_SEPAY_WEBHOOK' ? 'Hệ thống tự động (SePay)' : entry.actorUsername ?? 'Hệ thống'}
                      {entry.evidenceReference ? ` · Chứng từ: ${entry.evidenceReference}` : ''}
                    </p>
                    {entry.reason && <p>{entry.reason.replace(/^\[[A-Z0-9_]+\]\s*/, '')}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
