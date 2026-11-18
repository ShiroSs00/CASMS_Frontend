import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Badge, Button } from '@/shared/ui'
import { saleTermsApi } from '../api/sale-terms'

export function SaleTermsSetupButton({ cruiseId }: { cruiseId: string }) {
  const pending = useReadQuery('pending-sale-terms:' + cruiseId,
    useCallback(signal => saleTermsApi.pendingSetup(cruiseId, signal), [cruiseId]))
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  async function send() {
    if (lock.current || pending.data || sent) return
    lock.current = true
    setBusy(true)
    setError(false)
    try {
      if (!await saleTermsApi.requestSetup(cruiseId)) throw new Error()
      setSent(true)
    } catch {
      setError(true)
      pending.retry()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (sent || pending.data) return <Badge label="Đã gửi yêu cầu cho Vận hành" tone="info" />
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
    <Button tone="secondary" size="compact" autoWidth disabled={pending.loading || busy} onClick={() => void send()}>
      {busy ? 'Đang gửi…' : 'Yêu cầu cấu hình'}
    </Button>
    {error && !pending.loading && <span role="alert" style={{ fontSize: 12, color: 'var(--danger, #b42318)' }}>Chưa gửi được yêu cầu. Thử lại.</span>}
  </div>
}
