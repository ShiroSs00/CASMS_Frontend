import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button } from '@/shared/ui'
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

  if (sent || pending.data) return <span role="status">Đã gửi yêu cầu cho OPS</span>
  return <div>
    <Button tone="secondary" autoWidth disabled={pending.loading || busy} onClick={() => void send()}>
      {busy ? 'Đang gửi…' : 'Yêu cầu cấu hình'}
    </Button>
    {error && !pending.loading && <p role="alert">Chưa gửi được. Thử lại.</p>}
  </div>
}
