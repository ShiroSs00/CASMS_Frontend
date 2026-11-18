import { useId, useRef, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { Badge, Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import styles from './LiveBooking.module.css'

type Rate = { effectiveOn: string; vndPerUsd: number; source: string }
const path = '/usd-display-rate'
const loadRate = (signal: AbortSignal) => apiRequest<Rate | null>(path, { signal })
const today = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

export function UsdDisplayRate() {
  const current = useReadQuery('finance-usd-display-rate', loadRate)
  const id = useId()
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  return <Panel title="Tỷ giá USD tham khảo" subtitle="Dùng để quy đổi và hiển thị giá gói VND tham khảo trên Web Booking.">
    {current.loading && <Loading label="Đang tải tỷ giá…" />}
    {current.error && <Notice title="Chưa đọc được tỷ giá" tone="error"><Button tone="secondary" size="compact" autoWidth onClick={current.retry}>Thử lại</Button></Notice>}
    {!current.loading && !current.error && <div className={styles.financeRateBanner}>
      <div>
        {current.data ? <>
          <p className={styles.financeRateValue}>1 USD ≈ {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(current.data.vndPerUsd)} VND</p>
          <p className={styles.financeRateMeta}>Hiệu lực từ {current.data.effectiveOn.split('-').reverse().join('/')} · Nguồn: {current.data.source}</p>
        </> : <>
          <p className={styles.financeRateValue}>Chưa công bố tỷ giá tham khảo</p>
          <p className={styles.financeRateMeta}>Nhập tỷ giá mới bên dưới để bật hiển thị quy đổi VND.</p>
        </>}
      </div>
      <Badge label={current.data ? 'Đang áp dụng' : 'Chưa công bố'} tone={current.data ? 'success' : 'neutral'} />
    </div>}
    <form className={styles.stack} onSubmit={async event => {
      event.preventDefault()
      if (lock.current) return
      lock.current = true
      setBusy(true)
      setMessage('')
      setError('')
      try {
        await apiRequest(path, { method: 'PUT', body: { effectiveOn: date, vndPerUsd: amount, source: source.trim() } })
        setMessage('Đã lưu tỷ giá tham khảo.')
        current.retry()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Chưa lưu được tỷ giá.')
      } finally {
        lock.current = false
        setBusy(false)
      }
    }}>
      <div className={styles.financeRateForm}>
        <Field htmlFor={id+'-date'} label="Ngày hiệu lực"><input id={id+'-date'} type="date" max={today()}
          value={date} required disabled={busy} onChange={event => setDate(event.target.value)} /></Field>
        <Field htmlFor={id+'-rate'} label="Số VND đổi 1 USD"><input id={id+'-rate'} type="number" min="0.0001"
          max="99999999.9999" step="0.0001" placeholder="Ví dụ: 25450" value={amount} required disabled={busy} onChange={event => setAmount(event.target.value)} /></Field>
        <Field htmlFor={id+'-source'} label="Nguồn tỷ giá"><input id={id+'-source'} maxLength={160}
          placeholder="Ví dụ: Vietcombank" value={source} required disabled={busy} onChange={event => setSource(event.target.value)} /></Field>
      </div>
      <div className={styles.formActions}>
        <Button type="submit" autoWidth busy={busy} disabled={!date || !amount || !source.trim()}>Lưu tỷ giá</Button>
      </div>
      {message && <Notice title="Đã cập nhật tỷ giá" tone="success">{message}</Notice>}
      {error && <Notice title="Chưa lưu được tỷ giá" tone="error">{error}</Notice>}
    </form>
  </Panel>
}
