import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Badge, Button } from '@/shared/ui'
import { saleTermsApi } from '../api/sale-terms'
import styles from './ManagerWorkspace.module.css'

export function SaleTermsSetupButton({ cruiseId, onSent }: { cruiseId: string; onSent?: () => void }) {
  const pending = useReadQuery('pending-sale-terms:' + cruiseId,
    useCallback(signal => saleTermsApi.pendingSetup(cruiseId, signal), [cruiseId]))
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  async function send() {
    if (lock.current || pending.loading || pending.error || pending.data || sent) return
    lock.current = true
    setBusy(true)
    setError(false)
    try {
      if (!await saleTermsApi.requestSetup(cruiseId)) throw new Error()
      setSent(true)
      onSent?.()
    } catch {
      setError(true)
      pending.retry()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (sent || pending.data) return <Badge label="Đã gửi yêu cầu cho Vận hành" tone="info" />
  if (pending.loading) return <span role="status">Đang kiểm tra yêu cầu gửi Vận hành…</span>
  if (pending.error) return <div role="alert"><p>Chưa kiểm tra được yêu cầu đã gửi. Tải lại trước khi gửi tiếp.</p><Button tone="secondary" size="compact" autoWidth onClick={pending.retry}>Kiểm tra lại yêu cầu</Button></div>
  return <div className={styles.saleTermsRequest}>
    <Button tone="secondary" size="compact" autoWidth disabled={pending.loading || busy} onClick={() => void send()}>
      {busy ? 'Đang gửi…' : 'Gửi yêu cầu cho Vận hành'}
    </Button>
    {error && !pending.loading && <span role="alert" style={{ fontSize: 12, color: 'var(--danger, #b42318)' }}>Chưa gửi được yêu cầu. Thử lại.</span>}
  </div>
}
