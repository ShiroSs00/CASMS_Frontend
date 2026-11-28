import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Notice } from '@/shared/ui'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { realBookingApi, type BookingDetail } from '../api/real-booking-api'
import {
  sepayPaymentApi,
  vietQrAttemptStorage,
  type BookingPaymentOptions,
  type CheckoutPaymentType,
  type SepayCheckoutOrder,
} from '../api/sepay-payment-api'
import { bookingMoney } from '../model/booking-presentation'
import { bookingWhen } from '../model/real-booking-view'
import { VietQrCheckoutModal } from './VietQrCheckoutModal'
import styles from './LiveBooking.module.css'

type ChoiceMode = 'RECOMMENDED' | 'FULL'

export function BookingPaymentActionCard({
  booking,
  onBookingReload,
}: {
  booking: BookingDetail
  onBookingReload: () => void
}) {
  const access = useSessionAccess()
  const isPassenger = access.status === 'ready' && access.roles.includes('PASSENGER')
  const userId = access.userId ?? ''
  if (!isPassenger) return null
  if (booking.bookingStatus === 'Cancelled') return null
  const isFullyPaid = booking.outstandingBalance != null && booking.outstandingBalance <= 0
  if (isFullyPaid) {
    return (
      <div className={styles.paymentActionBox} role="status">
        <div className={styles.paymentHeaderRow}>
          <strong>Trạng thái thanh toán</strong>
          <Badge label="Đã thanh toán đủ" tone="success" />
        </div>
        <p className={styles.helper}>
          Đặt chỗ đã hoàn tất thanh toán. Không còn khoản phải trả trước khi khởi hành.
        </p>
      </div>
    )
  }
  return (
    <BookingPaymentActionCardContent
      key={`${userId}:${booking.bookingId}`}
      userId={userId}
      booking={booking}
      onBookingReload={onBookingReload}
    />
  )
}

function BookingPaymentActionCardContent({
  userId,
  booking,
  onBookingReload,
}: {
  userId: string
  booking: BookingDetail
  onBookingReload: () => void
}) {
  const optionsQuery = useReadQuery(
    `sepay-options:${userId}:${booking.bookingId}:true`,
    useCallback(
      signal => sepayPaymentApi.getOptions(booking.bookingId, signal),
      [booking.bookingId],
    ),
  )

  const [choiceMode, setChoiceMode] = useState<ChoiceMode>('RECOMMENDED')
  const [activeOrder, setActiveOrder] = useState<SepayCheckoutOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [contractBusy, setContractBusy] = useState(false)
  const [contractNotice, setContractNotice] = useState('')
  const [error, setError] = useState('')
  const [balanceChanged, setBalanceChanged] = useState(false)
  const [uncertainKey, setUncertainKey] = useState<string | null>(() =>
    userId ? (vietQrAttemptStorage.read(userId, booking.bookingId)?.idempotencyKey ?? null) : null,
  )
  const lock = useRef(false)

  async function acceptOnlineContract() {
    if (contractBusy || lock.current) return
    setContractBusy(true)
    setError('')
    setContractNotice('')
    try {
      await realBookingApi.acceptContract(booking.bookingId, `E-CONTRACT-${booking.bookingReference}`)
      setContractNotice('Đã chấp nhận hợp đồng điện tử thành công.')
      onBookingReload()
      optionsQuery.retry()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa thể chấp nhận hợp đồng điện tử. Vui lòng thử lại.')
    } finally {
      setContractBusy(false)
    }
  }

  if (optionsQuery.loading) {
    return (
      <div className={styles.paymentActionBox} role="status">
        <p className={styles.helper}>Đang kiểm tra khoản cần thanh toán và lệnh VietQR từ hệ thống…</p>
      </div>
    )
  }

  if (optionsQuery.error) {
    const forbidden = optionsQuery.error instanceof ApiError && optionsQuery.error.status === 403
    return (
      <Notice
        title={forbidden ? 'Không thuộc phạm vi thanh toán của tài khoản này' : 'Chưa tải được thông tin thanh toán VietQR'}
        tone={forbidden ? 'warning' : 'error'}
      >
        {forbidden ? (
          'Đặt chỗ này thuộc tài khoản hành khách khác. Vui lòng đăng nhập đúng tài khoản đã đặt chỗ để thanh toán.'
        ) : (
          <>
            <p>{optionsQuery.error instanceof Error ? optionsQuery.error.message : 'Vui lòng thử tải lại.'}</p>
            <Button tone="secondary" size="compact" autoWidth onClick={optionsQuery.retry}>
              Tải lại thông tin thanh toán
            </Button>
          </>
        )}
      </Notice>
    )
  }

  const options: BookingPaymentOptions | null = optionsQuery.data
  if (!options) return null

  const pendingOrder = options.activePendingOrder
  const recommended = options.recommendedOption
  const canSwitchToFull = Boolean(
    options.vietQrEligible
      && recommended
      && recommended.paymentType !== 'FULL'
      && options.fullPaymentOption?.available
      && options.fullPaymentOption.amountVnd > recommended.amountVnd,
  )

  const selectedType: CheckoutPaymentType =
    choiceMode === 'FULL' && canSwitchToFull ? 'FULL' : (recommended?.paymentType ?? 'FULL')
  const selectedAmountVnd =
    selectedType === 'FULL'
      ? (options.fullPaymentOption?.amountVnd ?? options.outstandingBalanceVnd)
      : (recommended?.amountVnd ?? options.outstandingBalanceVnd)
  const selectedInstallmentId = selectedType === 'FULL' ? null : (recommended?.installmentId ?? null)
  const selectedSequenceNo = selectedType === 'FULL' ? null : (recommended?.sequenceNo ?? null)
  const selectedLabel =
    selectedType === 'FULL'
      ? 'Thanh toán toàn bộ số dư còn lại'
      : (recommended?.label ?? 'Thanh toán đặt chỗ')
  const selectedDueAt =
    selectedType === 'FULL' ? (options.fullPaymentOption?.dueAt ?? null) : (recommended?.dueAt ?? null)

  async function startCheckout() {
    if (lock.current || !options || !options.vietQrEligible) return
    lock.current = true
    setBusy(true)
    setError('')
    setBalanceChanged(false)

    // Giữ nguyên khóa idempotency nếu lần gửi trước chưa rõ kết quả cho cùng khoản chọn
    const stored = vietQrAttemptStorage.read(userId, booking.bookingId)
    const canReuseStoredKey =
      stored != null
      && stored.paymentType === selectedType
      && stored.installmentId === selectedInstallmentId
      && stored.sequenceNo === selectedSequenceNo
      && stored.expectedAmountVnd === selectedAmountVnd

    const idempotencyKey = canReuseStoredKey
      ? stored.idempotencyKey
      : `VQR-${booking.bookingId.slice(0, 8)}-${selectedType}-${selectedSequenceNo ?? 0}-${crypto.randomUUID().slice(0, 8)}`

    vietQrAttemptStorage.write(userId, booking.bookingId, {
      idempotencyKey,
      paymentType: selectedType,
      installmentId: selectedInstallmentId,
      sequenceNo: selectedSequenceNo,
      expectedAmountVnd: selectedAmountVnd,
    })

    try {
      const created = await sepayPaymentApi.createCheckout({
        bookingId: booking.bookingId,
        paymentType: selectedType,
        installmentId: selectedInstallmentId,
        sequenceNo: selectedSequenceNo,
        idempotencyKey,
        expectedOutstandingBalance:
          booking.currency === 'VND' ? options.outstandingBalanceVnd : options.outstandingBalance,
        expectedAmountVnd: selectedAmountVnd,
      })
      vietQrAttemptStorage.clear(userId, booking.bookingId)
      setUncertainKey(null)
      setActiveOrder(created)
      optionsQuery.retry()
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'PAYMENT_BALANCE_CHANGED') {
        vietQrAttemptStorage.clear(userId, booking.bookingId)
        setUncertainKey(null)
        setBalanceChanged(true)
        setError(reason.message)
      } else if (mutationOutcomeUnknown(reason)) {
        setUncertainKey(idempotencyKey)
        setError(
          'Chưa nhận được phản hồi rõ ràng từ máy chủ. Bạn có thể bấm nút bên dưới để thử lại an toàn bằng cùng mã yêu cầu hoặc tải lại đặt chỗ để mở lệnh đã tạo.',
        )
      } else {
        vietQrAttemptStorage.clear(userId, booking.bookingId)
        setUncertainKey(null)
        setError(reason instanceof Error ? reason.message : 'Chưa tạo được mã VietQR. Vui lòng thử lại.')
      }
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function handleReloadAll() {
    setError('')
    setBalanceChanged(false)
    onBookingReload()
    optionsQuery.retry()
  }

  return (
    <div className={styles.paymentActionBox}>
      {booking.bookingStatus === 'Draft' && booking.contractStatus !== 'Accepted' && (
        <Notice title="Xác nhận hợp đồng điện tử (RG-11)" tone="info">
          <p>
            Để đặt chỗ tự động chuyển sang <strong>Đã xác nhận</strong> ngay khi thanh toán đủ khoản yêu cầu qua
            VietQR, vui lòng chấp nhận hợp đồng điện tử trực tuyến.
          </p>
          <div className={styles.actions}>
            <Button autoWidth busy={contractBusy} disabled={contractBusy || busy} onClick={() => void acceptOnlineContract()}>
              {contractBusy ? 'Đang ghi nhận hợp đồng…' : 'Chấp nhận hợp đồng điện tử'}
            </Button>
          </div>
        </Notice>
      )}
      {contractNotice && (
        <Notice title="Hợp đồng điện tử" tone="success">
          {contractNotice}
        </Notice>
      )}
      {!options.vietQrEligible ? (
        <Notice
          title={options.fullyPaid ? 'Đặt chỗ đã thanh toán đủ' : 'Chưa thể tạo lệnh thanh toán VietQR'}
          tone={options.fullyPaid ? 'success' : 'neutral'}
        >
          {options.ineligibleReason ?? 'Đặt chỗ hiện không đủ điều kiện tạo mã VietQR.'}
        </Notice>
      ) : (
        <>
          {pendingOrder && !pendingOrder.stale && (
            <div className={styles.pendingOrderBanner}>
              <div className={styles.pendingOrderHead}>
                <div>
                  <Badge label="Đang có lệnh VietQR chờ chuyển khoản" tone="warning" />
                  <h3>
                    {pendingOrder.stageDescription ?? 'Thanh toán đặt chỗ'} ·{' '}
                    <strong>{bookingMoney(pendingOrder.amountVnd, 'VND')}</strong>
                  </h3>
                  <p className={styles.helper}>
                    Nội dung chuyển khoản: <strong className={styles.monoCode}>{pendingOrder.transferContent}</strong>
                  </p>
                </div>
                <Button autoWidth onClick={() => setActiveOrder(pendingOrder)}>
                  Mở lại mã VietQR đang chờ
                </Button>
              </div>
            </div>
          )}

          {pendingOrder && pendingOrder.stale && (
            <Notice title="Lệnh VietQR trước đã lệch với số dư hiện tại" tone="warning">
              Số dư đặt chỗ đã thay đổi sau khi tạo mã QR cũ ({bookingMoney(pendingOrder.amountVnd, 'VND')}). Không dùng
              lại mã cũ; hãy tạo mã VietQR mới theo số tiền mới nhất bên dưới.
            </Notice>
          )}

          {(!pendingOrder || pendingOrder.stale) && recommended && (
            <div className={styles.payableSummary}>
              <div className={styles.payableCopy}>
                <span className={styles.payableEyebrow}>Thanh toán trực tuyến qua VietQR (VND)</span>
                <h3>
                  {selectedLabel} · <strong>{bookingMoney(selectedAmountVnd, 'VND')}</strong>
                </h3>
                <p className={styles.helper}>
                  {selectedDueAt ? `Hạn thanh toán đợt: ${bookingWhen(selectedDueAt)}. ` : ''}
                  {options.holdExpiresAt && options.bookingStatus === 'Draft'
                    ? `Hạn giữ chỗ: ${bookingWhen(options.holdExpiresAt)}.`
                    : ''}
                </p>
              </div>

              {canSwitchToFull && (
                <div className={styles.choiceSwitch} role="radiogroup" aria-label="Chọn khoản thanh toán VietQR">
                  <label className={styles.choiceOption}>
                    <input
                      type="radio"
                      name={`vietqr-choice-${booking.bookingId}`}
                      checked={choiceMode === 'RECOMMENDED'}
                      disabled={busy}
                      onChange={() => setChoiceMode('RECOMMENDED')}
                    />
                    <span>
                      <strong>{recommended.label}</strong> · {bookingMoney(recommended.amountVnd, 'VND')}
                    </span>
                  </label>
                  <label className={styles.choiceOption}>
                    <input
                      type="radio"
                      name={`vietqr-choice-${booking.bookingId}`}
                      checked={choiceMode === 'FULL'}
                      disabled={busy}
                      onChange={() => setChoiceMode('FULL')}
                    />
                    <span>
                      <strong>Thanh toán toàn bộ còn lại</strong> ·{' '}
                      {bookingMoney(options.fullPaymentOption?.amountVnd ?? options.outstandingBalanceVnd, 'VND')}
                    </span>
                  </label>
                </div>
              )}

              <div className={styles.actions}>
                <Button autoWidth busy={busy} disabled={busy} onClick={() => void startCheckout()}>
                  {busy
                    ? 'Đang tạo mã VietQR…'
                    : uncertainKey
                      ? `Kiểm tra / thử lại đúng lệnh ${bookingMoney(selectedAmountVnd, 'VND')}`
                      : `Thanh toán qua VietQR · ${bookingMoney(selectedAmountVnd, 'VND')}`}
                </Button>
                <Button tone="secondary" size="compact" autoWidth disabled={busy} onClick={handleReloadAll}>
                  Làm mới số dư
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <Notice title={balanceChanged ? 'Số dư đặt chỗ vừa thay đổi' : 'Chưa thể tạo mã VietQR'} tone={balanceChanged ? 'warning' : 'error'}>
          <p>{error}</p>
          <div className={styles.actions}>
            <Button tone="secondary" size="compact" autoWidth onClick={handleReloadAll}>
              Tải lại thông tin đặt chỗ
            </Button>
          </div>
        </Notice>
      )}

      {activeOrder && (
        <VietQrCheckoutModal
          order={activeOrder}
          onClose={() => {
            setActiveOrder(null)
            optionsQuery.retry()
          }}
          onPaid={() => {
            vietQrAttemptStorage.clear(userId, booking.bookingId)
            setUncertainKey(null)
            onBookingReload()
            optionsQuery.retry()
          }}
        />
      )}
    </div>
  )
}
