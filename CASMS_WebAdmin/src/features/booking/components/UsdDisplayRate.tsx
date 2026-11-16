import { useId, useRef, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice, Panel } from '@/shared/ui'

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
  return <Panel title="Tỷ giá USD tham khảo" subtitle="Dùng để hiển thị giá gói VND trên Web Booking.">
    {current.loading && <Loading label="Đang tải tỷ giá…" />}
    {current.error && <Notice title="Chưa đọc được tỷ giá" tone="error"><Button onClick={current.retry}>Thử lại</Button></Notice>}
    {current.data ? <p>1 USD ≈ <strong>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(current.data.vndPerUsd)} VND</strong>
      {' · '}{current.data.effectiveOn.split('-').reverse().join('/')}{' · '}{current.data.source}</p>
      : !current.loading && !current.error && <p>Chưa công bố tỷ giá tham khảo.</p>}
    <form onSubmit={async event => {
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
      <Field htmlFor={id+'-date'} label="Ngày hiệu lực"><input id={id+'-date'} type="date" max={today()}
        value={date} required disabled={busy} onChange={event => setDate(event.target.value)} /></Field>
      <Field htmlFor={id+'-rate'} label="Số VND đổi 1 USD"><input id={id+'-rate'} type="number" min="0.0001"
        max="99999999.9999" step="0.0001" value={amount} required disabled={busy} onChange={event => setAmount(event.target.value)} /></Field>
      <Field htmlFor={id+'-source'} label="Nguồn tỷ giá"><input id={id+'-source'} maxLength={160}
        value={source} required disabled={busy} onChange={event => setSource(event.target.value)} /></Field>
      <Button type="submit" busy={busy} disabled={!date || !amount || !source.trim()}>Lưu tỷ giá</Button>
      {message && <p role="status">{message}</p>}
      {error && <Notice title="Chưa lưu được tỷ giá" tone="error">{error}</Notice>}
    </form>
  </Panel>
}
