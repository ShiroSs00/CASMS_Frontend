import { useState } from 'react'
import { formatVndRate, useUsdReference } from './usd-reference'
import styles from './UsdReference.module.css'

export function UsdReference({ amount, currency }: { amount: number | null; currency: string | null }) {
  const [mode, setMode] = useState<'VND' | 'USD'>('VND')
  const applicable = currency === 'VND' && amount != null
  const { rate, loading } = useUsdReference(applicable)
  if (!applicable) return null

  const formattedVnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)
  const formattedUsd = rate
    ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount / rate.vndPerUsd)
    : null

  return (
    <div className={styles.wrap}>
      <p className={styles.heading}>Đơn vị hiển thị thanh toán</p>
      <div className={styles.cards} role="group" aria-label="Chọn đơn vị hiển thị số tiền thanh toán">
        <button
          type="button"
          className={`${styles.card} ${mode === 'VND' ? styles.cardActive : ''}`}
          aria-pressed={mode === 'VND'}
          onClick={() => setMode('VND')}
        >
          <span className={`${styles.icon} ${styles.iconVnd}`} aria-hidden="true">₫</span>
          <span className={styles.copy}>
            <span className={styles.title}>VND · VietQR</span>
            <span className={styles.rate}>Thanh toán bằng VND</span>
          </span>
        </button>

        <button
          type="button"
          className={`${styles.card} ${mode === 'USD' ? styles.cardActive : ''}`}
          aria-pressed={mode === 'USD'}
          onClick={() => setMode(current => (current === 'USD' ? 'VND' : 'USD'))}
        >
          <span className={`${styles.icon} ${styles.iconUsd}`} aria-hidden="true">$</span>
          <span className={styles.copy}>
            <span className={styles.title}>USD · Quy đổi tham khảo</span>
            <span className={styles.rate}>
              {loading
                ? 'Đang tải tỷ giá…'
                : rate
                  ? `1 USD ≈ ${formatVndRate(rate.vndPerUsd)} VND`
                  : 'Chưa có tỷ giá tham khảo'}
            </span>
          </span>
        </button>
      </div>

      {mode === 'USD' && (
        <p className={styles.result} role="status">
          {loading ? (
            'Đang tải tỷ giá quy đổi…'
          ) : rate && formattedUsd ? (
            <>
              <strong>≈ {formattedUsd} USD</strong> · Tỷ giá ngày {rate.effectiveOn.split('-').reverse().join('/')} · Số tiền thực thu qua VietQR là <strong>{formattedVnd} VND</strong>.
            </>
          ) : (
            `Chưa có tỷ giá tham khảo. Số tiền thanh toán thực tế là ${formattedVnd} VND.`
          )}
        </p>
      )}
    </div>
  )
}
