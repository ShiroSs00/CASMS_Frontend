import { useId, useRef, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { Badge, Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import styles from './LiveBooking.module.css'

type Rate = {
  effectiveOn: string
  vndPerUsd: number
  source: string
  publishedAt?: string | null
  autoSynced?: boolean
}

type SyncResult = Rate & {
  providerUsed?: string
  fallbackUsed?: boolean
  syncedCurrenciesCount?: number
  message?: string
}

const path = '/usd-display-rate'
const loadRate = (signal: AbortSignal) => apiRequest<Rate | null>(path, { signal })
const today = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

function formatPublishedAt(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function UsdDisplayRate() {
  const current = useReadQuery('finance-usd-display-rate', loadRate)
  const id = useId()
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ date?: string; amount?: string; source?: string }>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [anomalyConfirm, setAnomalyConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const lock = useRef(false)

  async function triggerSync(force = false) {
    if (lock.current) return
    lock.current = true
    setSyncing(true)
    setMessage('')
    setError('')
    setAnomalyConfirm(false)
    try {
      const result = await apiRequest<SyncResult>(`${path}/sync${force ? '?force=true' : ''}`, { method: 'POST' })
      const formatted = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(result.vndPerUsd)
      const countText = result.syncedCurrenciesCount ? ` (${result.syncedCurrenciesCount} cặp ngoại tệ)` : ''
      setMessage(`${result.message ?? 'Đã đồng bộ tỷ giá mới nhất.'} 1 USD = ${formatted} VND${countText}.`)
      current.retry()
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'FX_RATE_ANOMALY') {
        setAnomalyConfirm(true)
      }
      setError(cause instanceof Error ? cause.message : 'Chưa thể đồng bộ tỷ giá lúc này.')
    } finally {
      lock.current = false
      setSyncing(false)
    }
  }

  async function submitManualOverride(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const nextErrors: { date?: string; amount?: string; source?: string } = {}
    const todayStr = today()
    if (!date) nextErrors.date = 'Chọn ngày hiệu lực.'
    else if (date > todayStr) nextErrors.date = 'Ngày hiệu lực phải là hôm nay hoặc trước đó.'

    const parsedRate = Number(amount)
    if (!amount.trim() || !Number.isFinite(parsedRate)) {
      nextErrors.amount = 'Nhập số VND đổi 1 USD hợp lệ.'
    } else if (parsedRate < 1000 || parsedRate > 1000000) {
      nextErrors.amount = 'Tỷ giá phải nằm trong khoảng 1.000 đến 1.000.000 VND / 1 USD.'
    }

    if (!source.trim()) nextErrors.source = 'Nhập nguồn tỷ giá (VD: Vietcombank hoặc Tỷ giá nội bộ).'
    else if (source.trim().length > 160) nextErrors.source = 'Nguồn tỷ giá tối đa 160 ký tự.'

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    lock.current = true
    setBusy(true)
    setMessage('')
    setError('')
    setAnomalyConfirm(false)
    try {
      await apiRequest(path, {
        method: 'PUT',
        body: { effectiveOn: date, vndPerUsd: parsedRate, source: source.trim() },
      })
      setMessage('Đã lưu tỷ giá ghi đè thủ công và đồng bộ vào hệ thống thanh toán.')
      setAmount('')
      setSource('')
      current.retry()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được tỷ giá.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const updatedTime = formatPublishedAt(current.data?.publishedAt)

  return (
    <Panel
      title="Tỷ giá quy đổi USD / VND"
      subtitle="Hệ thống tự động cập nhật tỷ giá bán ra từ Vietcombank lúc 08:30 & 14:00 hằng ngày (giờ VN) để hiển thị tham khảo và quy đổi khi thanh toán."
    >
      {current.loading && <Loading label="Đang tải tỷ giá…" />}
      {current.error && (
        <Notice title="Chưa đọc được tỷ giá" tone="error">
          <Button tone="secondary" size="compact" autoWidth onClick={current.retry}>Thử lại</Button>
        </Notice>
      )}
      {!current.loading && !current.error && (
        <div className={styles.financeRateBanner}>
          <div>
            {current.data ? (
              <>
                <p className={styles.financeRateValue}>
                  1 USD ≈ {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(current.data.vndPerUsd)} VND
                </p>
                <p className={styles.financeRateMeta}>
                  Hiệu lực từ {current.data.effectiveOn.split('-').reverse().join('/')} · Nguồn: {current.data.source}
                  {updatedTime ? ` · Cập nhật lúc ${updatedTime}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className={styles.financeRateValue}>Chưa công bố tỷ giá tham khảo</p>
                <p className={styles.financeRateMeta}>
                  Bấm <strong>Đồng bộ tỷ giá ngay</strong> để kéo tỷ giá bán ra mới nhất từ Vietcombank, hoặc mở mục ghi đè thủ công bên dưới.
                </p>
              </>
            )}
          </div>
          <div className={styles.financeRateActions}>
            <Badge
              label={
                !current.data
                  ? 'Chưa công bố'
                  : current.data.autoSynced
                    ? 'Đồng bộ tự động'
                    : 'Ghi đè thủ công'
              }
              tone={!current.data ? 'neutral' : current.data.autoSynced ? 'success' : 'info'}
            />
            <Button autoWidth busy={syncing} disabled={busy || syncing} onClick={() => void triggerSync(false)}>
              {syncing ? 'Đang đồng bộ…' : 'Đồng bộ tỷ giá ngay'}
            </Button>
          </div>
        </div>
      )}

      {message && <Notice title="Đã cập nhật tỷ giá" tone="success">{message}</Notice>}
      {error && (
        <Notice title="Cảnh báo cập nhật tỷ giá" tone={anomalyConfirm ? 'warning' : 'error'}>
          <p>{error}</p>
          {anomalyConfirm && (
            <div className={styles.formActions}>
              <Button tone="secondary" size="compact" autoWidth busy={syncing} onClick={() => void triggerSync(true)}>
                Xác nhận vẫn áp dụng tỷ giá mới
              </Button>
            </div>
          )}
        </Notice>
      )}

      <details className={styles.financeRateOverride}>
        <summary>Ghi đè tỷ giá thủ công (chỉ dùng khi cần ấn định tỷ giá riêng)</summary>
        <form className={styles.stack} noValidate onSubmit={submitManualOverride}>
          <div className={styles.financeRateForm}>
            <Field htmlFor={id + '-date'} label="Ngày hiệu lực" error={fieldErrors.date}>
              <input
                id={id + '-date'}
                type="date"
                max={today()}
                value={date}
                required
                disabled={busy || syncing}
                aria-invalid={Boolean(fieldErrors.date)}
                onChange={event => {
                  setDate(event.target.value)
                  setFieldErrors(prev => ({ ...prev, date: undefined }))
                }}
              />
            </Field>
            <Field htmlFor={id + '-rate'} label="Số VND đổi 1 USD" error={fieldErrors.amount}>
              <input
                id={id + '-rate'}
                type="number"
                min="1000"
                max="1000000"
                step="0.0001"
                placeholder="Ví dụ: 25450"
                value={amount}
                required
                disabled={busy || syncing}
                aria-invalid={Boolean(fieldErrors.amount)}
                onChange={event => {
                  setAmount(event.target.value)
                  setFieldErrors(prev => ({ ...prev, amount: undefined }))
                }}
              />
            </Field>
            <Field htmlFor={id + '-source'} label="Nguồn tỷ giá" error={fieldErrors.source}>
              <input
                id={id + '-source'}
                maxLength={160}
                placeholder="Ví dụ: Vietcombank hoặc Tỷ giá nội bộ"
                value={source}
                required
                disabled={busy || syncing}
                aria-invalid={Boolean(fieldErrors.source)}
                onChange={event => {
                  setSource(event.target.value)
                  setFieldErrors(prev => ({ ...prev, source: undefined }))
                }}
              />
            </Field>
          </div>
          <div className={styles.formActions}>
            <Button type="submit" tone="secondary" autoWidth busy={busy} disabled={busy || syncing}>
              Lưu tỷ giá ghi đè
            </Button>
          </div>
        </form>
      </details>
    </Panel>
  )
}
