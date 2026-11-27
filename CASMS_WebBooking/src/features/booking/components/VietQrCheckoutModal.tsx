import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, Modal, Notice } from '@/shared/ui'
import {
  sepayPaymentApi,
  type SepayCheckoutOrder,
  type SepayPaymentStatus,
} from '../api/sepay-payment-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName, bookingWhen } from '../model/real-booking-view'
import styles from './LiveBooking.module.css'

const POLL_INTERVAL_MS = 4000
const LONG_WAIT_MS = 60_000

const contractLabel: Record<string, string> = {
  Draft: 'Chờ ký hợp đồng bản cứng',
  Accepted: 'Hợp đồng đã chấp thuận',
  Cancelled: 'Hợp đồng đã hủy',
}

export function VietQrCheckoutModal({
  order,
  onClose,
  onPaid,
}: {
  order: SepayCheckoutOrder
  onClose: () => void
  onPaid: () => void
}) {
  const [liveStatus, setLiveStatus] = useState<SepayPaymentStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkFeedback, setCheckFeedback] = useState('')
  const [networkError, setNetworkError] = useState('')
  const [offline, setOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false))
  const [qrImageFailed, setQrImageFailed] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [longWait, setLongWait] = useState(false)

  const checkInFlight = useRef(false)
  const notifiedPaid = useRef(false)
  const mounted = useRef(true)

  const effectiveStatus = liveStatus?.status ?? order.status
  const isTerminal =
    effectiveStatus === 'Confirmed'
    || effectiveStatus === 'Failed'
    || effectiveStatus === 'Cancelled'
    || effectiveStatus === 'Refunded'

  const checkStatus = useCallback(
    async (explicit: boolean, signal?: AbortSignal) => {
      if (checkInFlight.current) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOffline(true)
        setNetworkError('Thiết bị đang ngoại tuyến. Kiểm tra kết nối mạng rồi bấm Kiểm tra lại trạng thái.')
        return
      }
      checkInFlight.current = true
      if (explicit) {
        setChecking(true)
        setCheckFeedback('')
      }
      try {
        const result = await sepayPaymentApi.getStatus(order.paymentId, signal)
        if (!mounted.current || signal?.aborted) return
        setLiveStatus(result)
        setNetworkError('')
        setOffline(false)
        if (result.status === 'Confirmed') {
          setCheckFeedback('')
          if (!notifiedPaid.current) {
            notifiedPaid.current = true
            onPaid()
          }
        } else if (explicit && result.status === 'Pending') {
          setCheckFeedback(
            'Hệ thống chưa ghi nhận tiền về cho lệnh này. Giao dịch liên ngân hàng thường đồng bộ trong vài giây đến vài phút — bạn có thể bấm kiểm tra lại sau giây lát.',
          )
        } else if (result.status === 'Cancelled' || result.status === 'Failed') {
          setCheckFeedback('')
        }
      } catch (err) {
        if (!mounted.current || signal?.aborted) return
        setNetworkError(
          err instanceof Error
            ? err.message
            : 'Chưa kết nối được máy chủ để kiểm tra trạng thái. Lệnh VietQR vẫn được giữ nguyên.',
        )
      } finally {
        checkInFlight.current = false
        if (mounted.current && explicit) setChecking(false)
      }
    },
    [order.paymentId, onPaid],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const onOffline = () => {
      setOffline(true)
      setNetworkError('Mất kết nối mạng. Lệnh VietQR và thông tin chuyển khoản vẫn được giữ trên màn hình.')
    }
    const onOnline = () => {
      setOffline(false)
      setNetworkError('')
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  // Dừng polling ngay khi màn hình đóng, unmount, hoặc giao dịch chuyển sang trạng thái kết thúc
  useEffect(() => {
    if (isTerminal) return
    const controller = new AbortController()
    const timer = window.setInterval(() => {
      if (!offline) {
        void checkStatus(false, controller.signal)
      }
    }, POLL_INTERVAL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [isTerminal, offline, checkStatus])

  useEffect(() => {
    if (isTerminal) return
    const timer = window.setTimeout(() => {
      if (mounted.current) setLongWait(true)
    }, LONG_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [isTerminal])

  const showLongWait = !isTerminal && longWait

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyFeedback(`Đã sao chép ${label}.`)
    } catch {
      setCopyFeedback(`Không thể tự sao chép ${label}. Bạn có thể bôi đen và sao chép thủ công.`)
    }
  }

  const badgeProps =
    effectiveStatus === 'Confirmed'
      ? { label: 'Đã nhận thanh toán', tone: 'success' as const }
      : effectiveStatus === 'Pending'
        ? { label: 'Đang chờ chuyển khoản', tone: 'warning' as const }
        : effectiveStatus === 'Initiated'
          ? { label: 'Đang khởi tạo lệnh thanh toán', tone: 'info' as const }
          : effectiveStatus === 'Refunded'
            ? { label: 'Đã hoàn tiền', tone: 'neutral' as const }
            : { label: 'Lệnh đã đóng / hết hiệu lực', tone: 'error' as const }

  const effectiveBookingStatus = liveStatus?.bookingStatus ?? order.bookingStatus
  const effectiveContractStatus = liveStatus?.contractStatus ?? order.contractStatus

  return (
    <Modal
      title={`Thanh toán VietQR · ${order.bookingReference}`}
      protectChanges={false}
      onClose={onClose}
      footer={
        <>
          {(effectiveStatus === 'Pending' || effectiveStatus === 'Initiated') && (
            <Button
              autoWidth
              busy={checking}
              disabled={checking}
              onClick={() => void checkStatus(true)}
            >
              {checking
                ? 'Đang kiểm tra…'
                : effectiveStatus === 'Initiated'
                  ? 'Kiểm tra trạng thái'
                  : 'Tôi đã chuyển khoản'}
            </Button>
          )}
          <Button tone="secondary" autoWidth onClick={onClose}>
            {effectiveStatus === 'Confirmed'
              ? 'Hoàn tất & xem đặt chỗ'
              : effectiveStatus === 'Pending' || effectiveStatus === 'Initiated'
                ? 'Đóng (giữ lệnh đang chờ)'
                : 'Đóng'}
          </Button>
        </>
      }
    >
      <div className={styles.qrModalBody}>
        <div className={styles.qrHeaderMeta}>
          <div>
            <p className={styles.helper}>Khoản thanh toán</p>
            <strong className={styles.qrStageTitle}>{order.stageDescription ?? 'Thanh toán đặt chỗ'}</strong>
          </div>
          <Badge label={badgeProps.label} tone={badgeProps.tone} />
        </div>

        <dl className={styles.qrDeadlines}>
          <div>
            <dt>Mã đặt chỗ</dt>
            <dd className={styles.monoCode}>{order.bookingReference}</dd>
          </div>
          {order.installmentDueAt && (
            <div>
              <dt>Hạn thanh toán đợt</dt>
              <dd>{bookingWhen(order.installmentDueAt)}</dd>
            </div>
          )}
          {order.bookingHoldExpiresAt && effectiveBookingStatus === 'Draft' && (
            <div>
              <dt>Hạn giữ chỗ hiện tại</dt>
              <dd>{bookingWhen(order.bookingHoldExpiresAt)}</dd>
            </div>
          )}
          {order.expiresAt && (
            <div>
              <dt>Hạn hiệu lực lệnh QR</dt>
              <dd>{bookingWhen(order.expiresAt)}</dd>
            </div>
          )}
        </dl>

        {effectiveStatus === 'Confirmed' ? (
          <Notice title="Hệ thống đã ghi nhận khoản thanh toán của bạn" tone="success">
            <p>
              Số tiền đã ghi nhận:{' '}
              <strong>
                {bookingMoney(liveStatus?.confirmedAmount ?? order.amountVnd, liveStatus?.currency ?? 'VND')}
              </strong>
              {liveStatus?.processorReference ? ` · Mã tham chiếu: ${liveStatus.processorReference}` : ''}
            </p>
            <p>
              Trạng thái đặt chỗ:{' '}
              <strong>
                {effectiveBookingStatus ? (bookingStatusName[effectiveBookingStatus] ?? effectiveBookingStatus) : 'Đang cập nhật'}
              </strong>
              {effectiveContractStatus
                ? ` · ${contractLabel[effectiveContractStatus] ?? effectiveContractStatus}`
                : ''}
            </p>
            {effectiveBookingStatus === 'Draft' && effectiveContractStatus !== 'Accepted' && (
              <p>
                Khoản tiền đã được ghi nhận. Đặt chỗ sẽ tự động chuyển sang <strong>Đã xác nhận</strong> ngay sau khi
                hoàn tất ghi nhận hợp đồng bản cứng.
              </p>
            )}
            {liveStatus?.remainingBookingBalance != null && liveStatus.remainingBookingBalance > 0 && (
              <p>
                Số dư còn lại của đặt chỗ:{' '}
                <strong>{bookingMoney(liveStatus.remainingBookingBalance, liveStatus.currency)}</strong>. Lịch thanh toán
                của bạn đã được cập nhật.
              </p>
            )}
          </Notice>
        ) : effectiveStatus === 'Refunded' ? (
          <Notice title="Giao dịch thanh toán này đã được hoàn tiền" tone="neutral">
            <p>
              Khoản thanh toán cho lệnh này đã được xử lý hoàn tiền. Không chuyển khoản lại theo mã cũ; vui lòng kiểm tra
              trạng thái đặt chỗ và lịch thanh toán trên trang chi tiết.
            </p>
          </Notice>
        ) : effectiveStatus === 'Initiated' ? (
          <Notice title="Lệnh thanh toán VietQR đang được khởi tạo" tone="info">
            <p>
              Hệ thống đang hoàn tất khởi tạo lệnh chuyển khoản. Vui lòng đợi vài giây hoặc bấm{' '}
              <strong>Kiểm tra trạng thái</strong> để nhận thông tin chuyển khoản khi sẵn sàng.
            </p>
          </Notice>
        ) : effectiveStatus === 'Cancelled' || effectiveStatus === 'Failed' ? (
          <Notice title="Lệnh VietQR này không còn hiệu lực" tone="error">
            <p>
              {liveStatus?.failureReason === 'SUPERSEDED_BALANCE_CHANGED'
                ? 'Số dư đặt chỗ đã thay đổi nên lệnh cũ đã được đóng. Vui lòng đóng cửa sổ này, tải lại đặt chỗ và tạo mã VietQR mới.'
                : 'Lệnh thanh toán này đã bị đóng hoặc không thành công. Không chuyển khoản theo mã cũ này; vui lòng tải lại đặt chỗ để kiểm tra.'}
            </p>
          </Notice>
        ) : (
          <>
            {offline && (
              <Notice title="Mất kết nối mạng" tone="warning">
                Trình duyệt đang ngoại tuyến. Bạn vẫn có thể xem thông tin chuyển khoản bên dưới; khi có mạng trở lại,
                bấm <strong>Tôi đã chuyển khoản</strong> để hệ thống kiểm tra trạng thái.
              </Notice>
            )}

            {networkError && !offline && (
              <Notice title="Chưa kiểm tra được trạng thái từ máy chủ" tone="warning">
                <p>{networkError}</p>
                <div className={styles.actions}>
                  <Button tone="secondary" size="compact" autoWidth onClick={() => void checkStatus(true)}>
                    Kiểm tra lại trạng thái
                  </Button>
                </div>
              </Notice>
            )}

            <div className={styles.qrLayout}>
              <div className={styles.qrVisualPane}>
                {!qrImageFailed ? (
                  <img
                    src={order.qrCodeUrl}
                    alt={`Mã VietQR thanh toán ${order.bookingReference}`}
                    className={styles.qrImage}
                    onError={() => setQrImageFailed(true)}
                  />
                ) : (
                  <div className={styles.qrFallback}>
                    <strong>Không tải được hình ảnh QR</strong>
                    <p className={styles.helper}>
                      Bạn vẫn có thể mở ứng dụng ngân hàng và chuyển khoản thủ công theo đúng số tài khoản, số tiền và
                      nội dung bên cạnh.
                    </p>
                  </div>
                )}
                <p className={styles.helper}>
                  Quét mã bằng ứng dụng ngân hàng hỗ trợ VietQR. Hệ thống tự động kiểm tra trạng thái mỗi vài giây.
                </p>
              </div>

              <div className={styles.qrDetailsPane}>
                <dl className={styles.qrBankFacts}>
                  <div>
                    <dt>Ngân hàng thụ hưởng</dt>
                    <dd>{order.bankName}</dd>
                  </div>
                  <div>
                    <dt>Chủ tài khoản</dt>
                    <dd>{order.accountHolderName}</dd>
                  </div>
                  <div className={styles.qrCopyRow}>
                    <div>
                      <dt>Số tài khoản</dt>
                      <dd className={styles.monoCode}>{order.accountNumber}</dd>
                    </div>
                    <Button
                      tone="secondary"
                      size="compact"
                      autoWidth
                      onClick={() => void copyText(order.accountNumber, 'số tài khoản')}
                    >
                      Sao chép
                    </Button>
                  </div>
                  <div className={styles.qrCopyRow}>
                    <div>
                      <dt>Số tiền chính xác (VND)</dt>
                      <dd className={styles.qrAmountValue}>{bookingMoney(order.amountVnd, 'VND')}</dd>
                    </div>
                    <Button
                      tone="secondary"
                      size="compact"
                      autoWidth
                      onClick={() => void copyText(String(Math.round(order.amountVnd)), 'số tiền VND')}
                    >
                      Sao chép
                    </Button>
                  </div>
                  <div className={`${styles.qrCopyRow} ${styles.qrTransferHighlight}`}>
                    <div>
                      <dt>Nội dung chuyển khoản (bắt buộc đúng chính xác)</dt>
                      <dd className={styles.qrTransferCode}>{order.transferContent}</dd>
                    </div>
                    <Button
                      tone="secondary"
                      size="compact"
                      autoWidth
                      onClick={() => void copyText(order.transferContent, 'nội dung chuyển khoản')}
                    >
                      Sao chép
                    </Button>
                  </div>
                </dl>

                {copyFeedback && (
                  <p className={styles.copyStatus} role="status">
                    {copyFeedback}
                  </p>
                )}
              </div>
            </div>

            <Notice title="Lưu ý quan trọng để tự động ghi nhận" tone="info">
              Chuyển khoản <strong>đúng số tiền {bookingMoney(order.amountVnd, 'VND')}</strong> và{' '}
              <strong>giữ nguyên nội dung {order.transferContent}</strong>. Nút <em>Tôi đã chuyển khoản</em> chỉ làm mới
              trạng thái thực tế từ hệ thống; mọi khoản thiếu, dư hoặc sai nội dung sẽ chuyển bộ phận Tài chính đối soát.
            </Notice>

            {checkFeedback && (
              <p className={styles.helper} role="status">
                {checkFeedback}
              </p>
            )}

            {showLongWait && (
              <Notice title="Đang chờ ngân hàng đồng bộ?" tone="neutral">
                Giao dịch chuyển khoản đôi khi cần thêm vài phút để ngân hàng báo về hệ thống. Bạn có thể đóng màn hình
                này mà không mất lệnh — lệnh VietQR đang chờ sẽ hiển thị sẵn để bạn mở lại bất cứ lúc nào.
              </Notice>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
