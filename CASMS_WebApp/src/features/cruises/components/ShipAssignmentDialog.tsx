import { useEffect, useMemo, useRef, useState } from 'react'

import { Badge, Button, Loading, Modal, Notice } from '@/shared/ui'

import { cruiseApi } from '../api/cruise-api'
import type { CruiseDetailView } from '../model/cruise-view'
import type { ShipCandidate } from '../model/ship-assignment'
import styles from './Cruises.module.css'

export type AssignmentMode = 'assign' | 'change' | 'unassign'

function candidateTone(state: ShipCandidate['state']) {
  if (state === 'AVAILABLE') return 'success' as const
  if (state === 'REQUIRES_IMPACT_CHECK') return 'warning' as const
  return 'error' as const
}

function stateLabel(state: ShipCandidate['state']) {
  if (state === 'AVAILABLE') return 'KHẢ DỤNG'
  if (state === 'REQUIRES_IMPACT_CHECK') return 'CẦN IMPACT CHECK'
  return 'KHÔNG KHẢ DỤNG'
}

export function ShipAssignmentDialog({ detail, mode, onClose, onChanged }: {
  detail: CruiseDetailView
  mode: AssignmentMode
  onClose: () => void
  onChanged: () => void
}) {
  const [candidates, setCandidates] = useState<ShipCandidate[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  useEffect(() => {
    if (mode === 'unassign') return
    void cruiseApi.getShipCandidates(detail.cruise.cruiseId).then((items) => {
      setCandidates(items.filter((item) => item.ship.shipId !== detail.cruise.shipId))
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không tải được danh sách tàu.'))
  }, [detail.cruise.cruiseId, detail.cruise.shipId, mode])

  const selected = useMemo(() => candidates?.find((candidate) => candidate.ship.shipId === selectedId) ?? null, [candidates, selectedId])

  async function confirm() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (mode === 'unassign') {
        await cruiseApi.unassignShip(detail.cruise.cruiseId)
      } else if (selected?.state === 'AVAILABLE') {
        const operation = mode === 'assign' ? cruiseApi.assignShip : cruiseApi.changeShip
        await operation(detail.cruise.cruiseId, selected.ship.shipId)
      } else {
        return
      }
      onChanged()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được phân công tàu.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (mode === 'unassign') {
    return <Modal title="Gỡ tàu khỏi cruise" onClose={onClose} busy={busy}>
      <Notice title={`${detail.cruise.cruiseCode} · ${detail.ship?.shipName ?? 'Chưa phân công'}`} tone="warning"><p>Sau xác nhận, cruise sẽ chưa có tàu được phân công. Hệ thống sẽ kiểm tra các đặt chỗ trước khi gỡ tàu.</p></Notice>
      {error && <Notice title="Không thể gỡ tàu" tone="error"><p>{error}</p></Notice>}
      <div className={styles.dialogActions}><Button tone="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button tone="danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Đang xử lý…' : 'Xác nhận gỡ tàu'}</Button></div>
    </Modal>
  }

  return <Modal wide title={`${mode === 'assign' ? 'Phân công' : 'Đổi'} tàu cho ${detail.cruise.cruiseCode}`} onClose={onClose} busy={busy}>
    <p className={styles.dialogIntro}>Chọn tàu và đọc toàn bộ kết quả precheck trước khi xác nhận.</p>
    {detail.ship && <Notice title={`Tàu hiện tại · ${detail.ship.shipName}`} tone="warning"><p>{detail.ship.status} · {detail.ship.totalCapacity} khách{detail.bookingHasData ? ' · Cruise đã có booking nên thay tàu cần impact check.' : ''}</p></Notice>}
    {error && <Notice title="Không kiểm tra được khả dụng" tone="error"><p>{error}</p></Notice>}
    {!candidates && !error ? <Loading label="Đang kiểm tra các tàu…" /> : <div className={styles.candidates} role="radiogroup" aria-label="Chọn tàu">
      {candidates?.map((candidate) => <button type="button" role="radio" aria-checked={selectedId === candidate.ship.shipId} className={`${styles.candidate} ${selectedId === candidate.ship.shipId ? styles.candidateSelected : ''}`} key={candidate.ship.shipId} onClick={() => setSelectedId(candidate.ship.shipId)}>
        <span className={styles.candidateHeading}><strong>{candidate.ship.shipName} · {candidate.ship.shipCode}</strong><Badge label={stateLabel(candidate.state)} tone={candidateTone(candidate.state)} /></span>
        <span>{candidate.reasons.join(' ')}</span>
      </button>)}
    </div>}
    {selected && <Notice title={`Precheck · ${stateLabel(selected.state)}`} tone={candidateTone(selected.state)}><p>{selected.reasons.join(' ')}</p></Notice>}
    <div className={styles.dialogActions}><Button tone="secondary" disabled={busy} onClick={onClose}>Hủy</Button><Button disabled={busy || selected?.state !== 'AVAILABLE'} onClick={() => void confirm()}>{busy ? 'Đang xử lý…' : mode === 'assign' ? 'Xác nhận phân công' : 'Xác nhận đổi tàu'}</Button></div>
  </Modal>
}
