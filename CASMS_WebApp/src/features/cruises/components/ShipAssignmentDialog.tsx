import { ApiError } from '@/shared/api'
import { useEffect, useMemo, useRef, useState } from 'react'
import { actionInWorkScope, getSessionAccess, useSessionAccess } from '@/shared/auth'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'

import { Badge, Button, Loading, Modal, Notice } from '@/shared/ui'

import { cruiseApi } from '../api/cruise-api'
import type { CruiseDetailView } from '../model/cruise-view'
import type { ShipCandidate } from '../model/ship-assignment'
import styles from './Cruises.module.css'

export type AssignmentMode = 'assign' | 'change' | 'unassign'

function candidateTone(state: ShipCandidate['state']) {
  if (state === 'AVAILABLE') return 'success' as const
  if (state === 'REQUIRES_IMPACT_CHECK'||state==='UNKNOWN') return 'warning' as const
  return 'error' as const
}

function stateLabel(state: ShipCandidate['state']) {
  if (state === 'AVAILABLE') return 'KHẢ DỤNG'
  if (state === 'UNKNOWN') return 'CHƯA XÁC ĐỊNH'
  if (state === 'REQUIRES_IMPACT_CHECK') return 'CẦN KIỂM TRA TÁC ĐỘNG'
  return 'KHÔNG KHẢ DỤNG'
}

export function ShipAssignmentDialog({ detail, mode, onClose, onChanged }: {
  detail: CruiseDetailView
  mode: AssignmentMode
  onClose: () => void
  onChanged: () => void
}) {
  const access = useSessionAccess()
  const allowed = access.canDo({ assign: 'CRUISE_ASSIGN_SHIP', change: 'CRUISE_CHANGE_SHIP', unassign: 'CRUISE_UNASSIGN_SHIP' }[mode]) && detail.cruise.status==='DRAFT' && detail.bookingHasData===false && detail.assignmentCapabilities?.[mode]?.allowed===true
  const [candidates, setCandidates] = useState<ShipCandidate[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unknown,setUnknown]=useState(false)
  const [attempt,setAttempt]=useState(0)
  const lock = useRef(false)
  function assertCurrentSession(){
    const current=getSessionAccess(),permission={assign:'CRUISE_ASSIGN_SHIP',change:'CRUISE_CHANGE_SHIP',unassign:'CRUISE_UNASSIGN_SHIP'}[mode]
    if(current.userId!==access.userId||current.status!=='ready'||!current.permissions.includes(permission)||!actionInWorkScope(current.roles,permission))throw new ApiError('Phiên hoặc quyền phân công đã thay đổi. Mở lại hồ sơ bằng tài khoản hiện tại.',403)
  }

  useEffect(() => {
    if (mode === 'unassign'||!allowed) return
    const controller=new AbortController()
    void cruiseApi.getShipCandidates(detail.cruise.cruiseId,mode==='change',controller.signal).then((items) => {
      if(controller.signal.aborted)return
      setCandidates(items.filter((item) => item.ship.shipId !== detail.cruise.shipId))
    }).catch((reason: unknown) => {if(!controller.signal.aborted)setError(reason instanceof Error ? reason.message : 'Không tải được danh sách tàu.')})
    return ()=>controller.abort()
  }, [detail.cruise.cruiseId, detail.cruise.shipId, mode,allowed,attempt])

  const selected = useMemo(() => candidates?.find((candidate) => candidate.ship.shipId === selectedId) ?? null, [candidates, selectedId])

  async function confirm() {
    if (lock.current || !allowed || unknown) return
    lock.current = true
    setBusy(true)
    setError('')
    let sent=false
    try {
      const fresh=await cruiseApi.getDetail(detail.cruise.cruiseId)
      assertCurrentSession()
      if(fresh.cruise.status!=='DRAFT'||fresh.bookingHasData!==false||fresh.cruise.shipId!==detail.cruise.shipId||detail.cruise.revision!=null&&fresh.cruise.revision!==detail.cruise.revision||!fresh.assignmentCapabilities[mode].allowed)throw new ApiError('Điều kiện phân công đã thay đổi. Tải lại hồ sơ và đối chiếu tác động trước khi tiếp tục.',409)
      if (mode === 'unassign') {
        sent=true
        await cruiseApi.unassignShip(detail.cruise.cruiseId)
      } else if (selected?.state === 'AVAILABLE') {
        const checked=await cruiseApi.checkShip(detail.cruise.cruiseId,selected.ship.shipId,mode==='change')
        assertCurrentSession()
        if(!checked.allowed)throw new ApiError(checked.reasons.join(' · ')||'Tàu không còn đáp ứng điều kiện phân công.',409)
        const operation = mode === 'assign' ? cruiseApi.assignShip : cruiseApi.changeShip
        sent=true
        await operation(detail.cruise.cruiseId, selected.ship.shipId)
      } else {
        return
      }
      onChanged()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được phân công tàu.')
      if(sent&&mutationOutcomeUnknown(reason))setUnknown(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (mode === 'unassign') {
    return <Modal title="Gỡ tàu khỏi lần khởi hành" onClose={onClose} busy={busy} footer={<div className={styles.dialogActions}><Button tone="secondary" disabled={busy} onClick={onClose} data-overlay-dismiss>Hủy</Button><Button tone="danger" disabled={busy || !allowed || unknown} onClick={() => void confirm()}>{busy ? 'Đang xử lý…' : 'Xác nhận gỡ tàu'}</Button></div>}>
      <Notice title={`${detail.cruise.cruiseCode} · ${detail.ship?.shipName ?? 'Chưa phân công'}`} tone="warning"><p>Sau xác nhận, cruise sẽ chưa có tàu được phân công. Hệ thống sẽ kiểm tra các đặt chỗ trước khi gỡ tàu.</p></Notice>
      {error && <Notice title="Không thể gỡ tàu" tone="error"><p>{error}</p></Notice>}
      {unknown && <Notice title="Chưa xác định kết quả gỡ tàu" tone="warning">Đóng hộp thoại và tải lại hồ sơ để đối chiếu trước khi gửi yêu cầu mới.</Notice>}

    </Modal>
  }

  return <Modal wide title={`${mode === 'assign' ? 'Phân công' : 'Đổi'} tàu cho ${detail.cruise.cruiseCode}`} onClose={onClose} busy={busy} footer={<div className={styles.dialogActions}><Button tone="secondary" disabled={busy} onClick={onClose} data-overlay-dismiss>Hủy</Button><Button disabled={busy || !allowed || unknown || selected?.state !== 'AVAILABLE'} onClick={() => void confirm()}>{busy ? 'Đang xử lý…' : mode === 'assign' ? 'Xác nhận phân công' : 'Xác nhận đổi tàu'}</Button></div>}>
    {unknown&&<Notice title="Cần đối chiếu phân công" tone="warning">Chưa xác định được kết quả. Đóng hộp thoại và tải lại hồ sơ trước khi gửi lại.</Notice>}<p className={styles.dialogIntro}>Chọn tàu và đọc kết quả kiểm tra trước khi xác nhận.</p>
    {detail.ship && <Notice title={`Tàu hiện tại · ${detail.ship.shipName}`} tone="warning"><p>{detail.ship.status} · {detail.ship.totalCapacity} khách{detail.bookingHasData ? ' · Đã có đặt chỗ; cần đối chiếu tác động khi đổi tàu.' : ''}</p></Notice>}
    {!allowed && <Notice title="Chưa thể phân công tàu" tone="warning">Cần quyền phân công và lần khởi hành nháp chưa có đặt chỗ; tải lại hồ sơ để kiểm tra điều kiện hiện tại.</Notice>}
    {error && <Notice title="Chưa hoàn tất kiểm tra hoặc phân công" tone="error"><p>{error}</p>{!unknown&&allowed&&<Button tone="secondary" disabled={busy} onClick={()=>{setCandidates(null);setSelectedId('');setError('');setAttempt(value=>value+1)}}>Tải lại danh sách tàu</Button>}</Notice>}
    {candidates?.length===0&&<Notice title="Chưa có tàu để chọn">Danh sách không có tàu khác phù hợp để kiểm tra. Bộ phận quản lý tàu cần cập nhật hồ sơ và khả dụng tàu.</Notice>}
    {allowed&&!candidates && !error ? <Loading label="Đang kiểm tra các tàu…" /> : <div className={styles.candidates} role="radiogroup" aria-label="Chọn tàu">
      {candidates?.map((candidate,index) => <button type="button" role="radio" disabled={busy||!allowed} tabIndex={selectedId===candidate.ship.shipId||!selectedId&&index===0?0:-1} aria-checked={selectedId === candidate.ship.shipId} className={`${styles.candidate} ${selectedId === candidate.ship.shipId ? styles.candidateSelected : ''}`} key={candidate.ship.shipId} onClick={() => setSelectedId(candidate.ship.shipId)} onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return
        event.preventDefault();const options=candidates??[];if(!options.length)return
        const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+options.length)%options.length
        setSelectedId(options[next].ship.shipId);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
      }}>
        <span className={styles.candidateHeading}><strong>{candidate.ship.shipName} · {candidate.ship.shipCode}</strong><Badge label={stateLabel(candidate.state)} tone={candidateTone(candidate.state)} /></span>
        <span>{candidate.reasons.join(' ')}</span>
        {candidate.compatibility&&<span>Boong: {candidate.compatibility.decksCount??'Chưa rõ'} · Cabin: {candidate.compatibility.cabinsCount??'Chưa rõ'} · Sức chứa: {candidate.compatibility.totalCapacity??'Chưa rõ'} · Hành khách đã đặt: {candidate.compatibility.bookedPassengersCount??'Chưa rõ'}</span>}
        {candidate.impact&&<span>Phân bổ cabin bị ảnh hưởng: {candidate.impact.affectedCabinAssignmentsCount??'Chưa rõ'} · Hoạt động: {candidate.impact.affectedOnboardActivitiesCount??'Chưa rõ'}</span>}
      </button>)}
    </div>}
    {selected && <Notice title={`Kiểm tra tàu · ${stateLabel(selected.state)}`} tone={candidateTone(selected.state)}><p>{selected.reasons.join(' ')}</p></Notice>}

  </Modal>
}
