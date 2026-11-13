import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { Button, Loading, Modal, Notice } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { PlanView } from '../api/mainflow-api'
import type { CruiseRecord } from '../model/cruise-record'
import { readinessMessage } from '../model/readiness-copy'
import { useReadinessClock } from '../hooks/useReadinessClock'

export function ResumeSale({ cruise, plan, onReady, onChanged }: {
  cruise: CruiseRecord
  plan: PlanView | null | undefined
  onReady?: () => void
  onChanged: () => void
}) {
  const access = useSessionAccess()
  const allowed = access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_RESUME_SALE')
  const id = cruise.cruiseId
  const gate = useReadQuery(JSON.stringify(['resume-sale', access.userId, id, cruise.revision, plan?.revision, allowed]),
    useCallback(signal => allowed ? departureApi.saleReadiness(id, signal) : Promise.resolve(null), [id, allowed]))
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  const [needsReady, setNeedsReady] = useState(false)
  const lock = useRef(false)
  const now = useReadinessClock(gate.data?.validUntil)
  const canResume = allowed && Boolean(cruise.stoppedAt) && plan?.readyStatus === 'READY' && !needsReady &&
    !gate.loading && !gate.error && gate.data?.ready === true && Array.isArray(gate.data.blockers) && gate.data.blockers.length === 0 &&
    gate.data.cruiseRevision === cruise.revision && Boolean(gate.data.validUntil && Date.parse(gate.data.validUntil) > now)

  async function resume() {
    if (!canResume || lock.current || uncertain || cruise.revision == null) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await departureApi.resumeSale(id, { expectedRevision: cruise.revision })
      const record = await departureApi.publicSellability(id)
      if (saved.cruiseId !== id || saved.status !== 'PUBLISHED' || saved.stoppedAt || record.cruiseId !== id || record.publicSaleState === 'STOPPED') {
        throw new ApiError('Chưa đối chiếu được trạng thái bán sau thao tác.', 502)
      }
      setConfirm(false)
      onChanged()
    } catch (reason) {
      setUncertain(mutationOutcomeUnknown(reason))
      if (reason instanceof ApiError && reason.code === 'READY_CONFIRMATION_REQUIRED') {
        setNeedsReady(true)
        setConfirm(false)
      } else {
        setError(reason instanceof ApiError ? businessErrorMessage(reason.code, reason.message) : 'Chưa thể tiếp tục mở bán.')
      }
    } finally {
      setBusy(false)
      lock.current = false
    }
  }

  if (!allowed) return null
  return <Notice title="Tiếp tục mở bán" tone="warning">
    {gate.loading && <Loading label="Đang kiểm tra điều kiện tiếp tục bán…"/>}
    {gate.error && <p>Chưa đọc được điều kiện tiếp tục bán.</p>}
    {(needsReady || plan && plan.readyStatus !== 'READY') && <p>Cần xác nhận lại sẵn sàng mở bán ở Bước 2.</p>}
    {(needsReady || plan && plan.readyStatus !== 'READY') && onReady && <Button tone="secondary" onClick={onReady}>Đến bước xác nhận sẵn sàng mở bán</Button>}
    {gate.data?.blockers?.length ? <ul>{[...new Set(gate.data.blockers)].map(code => <li key={code}>{readinessMessage(code)}</li>)}</ul> : null}
    {uncertain && <p role="alert">Chưa xác định kết quả. Tải lại chuyến để đối chiếu trước khi thao tác tiếp.</p>}
    {error && !confirm && <p role="alert">{error}</p>}
    <Button tone="secondary" disabled={busy} onClick={() => { gate.retry(); onChanged() }}>Tải lại điều kiện và trạng thái bán</Button>
    {canResume && !uncertain && <Button disabled={busy} onClick={() => { setError(''); setConfirm(true) }}>Tiếp tục mở bán</Button>}
    {confirm && <Modal title="Xác nhận tiếp tục mở bán" busy={busy} onClose={() => setConfirm(false)}
      footer={<><Button tone="secondary" data-overlay-dismiss onClick={() => setConfirm(false)}>Quay lại</Button><Button busy={busy} disabled={!canResume || uncertain} onClick={() => void resume()}>Xác nhận tiếp tục bán</Button></>}>
      <p>Hệ thống sẽ kiểm tra lại điều kiện thương mại và khả năng nhận đặt chỗ của chuyến.</p>
      {error && <p role="alert">{error}</p>}
      {uncertain && <p role="alert">Đóng hộp thoại và tải lại trạng thái bán để đối chiếu.</p>}
    </Modal>}
  </Notice>
}
