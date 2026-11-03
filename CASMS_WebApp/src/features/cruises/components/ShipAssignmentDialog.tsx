import { ApiError } from '@/shared/api'
import { useEffect, useMemo, useRef, useState } from 'react'
import { actionInWorkScope, getSessionAccess, useSessionAccess } from '@/shared/auth'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'

import { Badge, Button, Field, Loading, Modal, Notice } from '@/shared/ui'

import { cruiseApi } from '../api/cruise-api'
import { departureApi } from '../api/departure-api'
import { ShipAssignmentDependencies } from './ShipAssignmentDependencies'
import { decodeShipAssignmentSafety } from '../model/departure-contract'
import type { CruiseDetailView } from '../model/cruise-view'
import type { ShipCandidate, ShipAssignmentSafety } from '../model/ship-assignment'
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
  const canInspect=access.roles.includes('CRUISE_MANAGER')&&access.canDo('CRUISE_ASSIGN_SHIP')
  const allowed = access.roles.includes('CRUISE_MANAGER') && access.canDo('CRUISE_ASSIGN_SHIP') && detail.assignmentCapabilities?.[mode]?.allowed===true
  const [candidates, setCandidates] = useState<ShipCandidate[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unknown,setUnknown]=useState(false)
  const [attempt,setAttempt]=useState(0)
  const [reason,setReason]=useState('')
  const [latestSafety,setLatestSafety]=useState<ShipAssignmentSafety|null>(null)
  const lock = useRef(false)
  function assertCurrentSession(){
    const current=getSessionAccess(),permission='CRUISE_ASSIGN_SHIP'
    if(current.userId!==access.userId||current.status!=='ready'||!current.roles.includes('CRUISE_MANAGER')||!current.permissions.includes(permission)||!actionInWorkScope(current.roles,permission))throw new ApiError('Phiên hoặc quyền phân công đã thay đổi. Mở lại hồ sơ bằng tài khoản hiện tại.',403)
  }

  useEffect(() => {
    if (mode === 'unassign'||!canInspect) return
    const controller=new AbortController()
    void cruiseApi.getShipCandidates(detail.cruise.cruiseId,mode==='change',controller.signal).then((items) => {
      if(controller.signal.aborted)return
      setCandidates(items.filter((item) => item.ship.shipId !== detail.cruise.shipId))
    }).catch((reason: unknown) => {if(!controller.signal.aborted)setError(reason instanceof Error ? reason.message : 'Không tải được danh sách tàu.')})
    return ()=>controller.abort()
  }, [detail.cruise.cruiseId, detail.cruise.shipId, mode,canInspect,attempt])

  const selected = useMemo(() => candidates?.find((candidate) => candidate.ship.shipId === selectedId) ?? null, [candidates, selectedId])
  const matchingSafety=latestSafety?.cruiseId===detail.cruise.cruiseId&&latestSafety.operation===mode.toUpperCase()&&latestSafety.currentShipId===detail.cruise.shipId&&latestSafety.requestedShipId===(mode==='unassign'?null:selectedId)?latestSafety:null
  const safety=matchingSafety??(mode==='unassign'?detail.shipAssignmentContext?.unassignSafety:selected?.impact?.shipAssignmentSafety??detail.shipAssignmentContext?.changeSafety)
  const mutationAllowed=allowed&&Boolean(safety?.canProceed)&&(mode!=='change'||safety?.requestedShipId===selectedId)
  const currentShipName=detail.shipAssignmentContext?.shipName??detail.ship?.shipName??(detail.cruise.shipId?'Chưa tải được tàu hiện tại':'Chưa phân công')

  async function confirm() {
    if (lock.current || !mutationAllowed || unknown) return
    lock.current = true
    setBusy(true)
    setError('')
    let sent=false
    try {
      const fresh=await cruiseApi.getDetail(detail.cruise.cruiseId)
      assertCurrentSession()
      const currentSafety=mode==='unassign'?fresh.shipAssignmentContext?.unassignSafety:fresh.shipAssignmentContext?.changeSafety
      if(currentSafety&&!currentSafety.canProceed)setLatestSafety(currentSafety)
      if(fresh.cruise.shipId!==detail.cruise.shipId||detail.cruise.revision!=null&&fresh.cruise.revision!==detail.cruise.revision||!fresh.assignmentCapabilities[mode].allowed)throw new ApiError(currentSafety?.blockers.join(' ')||'Điều kiện phân công đã thay đổi. Tải lại hồ sơ và đối chiếu tác động trước khi tiếp tục.',409)
      if (mode === 'unassign') {
        sent=true
        await cruiseApi.unassignShip(detail.cruise.cruiseId)
      } else if (selected?.state === 'AVAILABLE') {
        const checked=await cruiseApi.checkShip(detail.cruise.cruiseId,selected.ship.shipId,mode==='change')
        if(checked.impact)setLatestSafety(checked.impact.shipAssignmentSafety)
        assertCurrentSession()
        if(!checked.allowed)throw new ApiError(checked.reasons.join(' · ')||'Tàu không còn đáp ứng điều kiện phân công.',409)
        if(mode==='change'){
          if(fresh.cruise.revision==null||!reason.trim())throw new ApiError('Nhập lý do đổi tàu và tải lại phiên bản chuyến khởi hành trước khi tiếp tục.',422)
          const impact=await departureApi.impact(detail.cruise.cruiseId,{newShipId:selected.ship.shipId,expectedRevision:fresh.cruise.revision,reason:reason.trim()})
          if(impact.shipAssignmentSafety)setLatestSafety(impact.shipAssignmentSafety)
          assertCurrentSession()
          if(!impact.canProceed||!impact.shipAssignmentSafety?.canProceed||impact.shipAssignmentSafety.requestedShipId!==selected.ship.shipId||impact.currentRevision!==fresh.cruise.revision)throw new ApiError(impact.blockers?.join(' · ')||'Đánh giá tác động chưa cho phép đổi tàu.',409)
          sent=true
          await cruiseApi.changeShip(detail.cruise.cruiseId,selected.ship.shipId,fresh.cruise.revision,reason.trim())
        }else{
          sent=true
          await cruiseApi.assignShip(detail.cruise.cruiseId,selected.ship.shipId)
        }
      } else {
        return
      }
      const actual=await cruiseApi.getDetail(detail.cruise.cruiseId)
      const expectedShip=mode==='unassign'?null:selectedId
      if(actual.cruise.shipId!==expectedShip)throw new ApiError('Chưa đối chiếu được phân công vừa lưu. Tải lại hồ sơ trước khi gửi tiếp.',502)
      await cruiseApi.assignmentContext(detail.cruise.cruiseId)
      if(expectedShip)await cruiseApi.shipCompatibility(detail.cruise.cruiseId,expectedShip)
      onChanged()
      onClose()
    } catch (reason) {
      if(reason instanceof ApiError&&reason.details&&typeof reason.details==='object'&&'shipAssignmentSafety' in reason.details){
        try{setLatestSafety(decodeShipAssignmentSafety(reason.details.shipAssignmentSafety,detail.cruise.cruiseId,mode==='unassign'?null:selectedId))}catch{setUnknown(true)}
      }
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được phân công tàu.')
      if(sent&&mutationOutcomeUnknown(reason))setUnknown(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (mode === 'unassign') {
    return <Modal title="Gỡ tàu khỏi chuyến khởi hành" onClose={onClose} busy={busy} footer={<div className={styles.dialogActions}><Button tone="secondary" disabled={busy} onClick={onClose} data-overlay-dismiss>Hủy</Button><Button tone="danger" disabled={busy || !mutationAllowed || unknown} onClick={() => void confirm()}>{busy ? 'Đang xử lý…' : 'Xác nhận gỡ tàu'}</Button></div>}>
      <Notice title={`${detail.cruise.cruiseCode} · ${currentShipName}`} tone="warning"><p>Sau xác nhận, chuyến khởi hành sẽ chưa có tàu được phân công. Hệ thống sẽ kiểm tra đặt chỗ và dữ liệu phụ thuộc trước khi gỡ tàu.</p></Notice>
      {safety&&<ShipAssignmentDependencies safety={safety}/>}
      {error && <Notice title="Không thể gỡ tàu" tone="error"><p>{error}</p></Notice>}
      {unknown && <Notice title="Chưa xác định kết quả gỡ tàu" tone="warning">Đóng hộp thoại và tải lại hồ sơ để đối chiếu trước khi gửi yêu cầu mới.</Notice>}

    </Modal>
  }

  return <Modal wide title={`${mode === 'assign' ? 'Phân công' : 'Đổi'} tàu cho ${detail.cruise.cruiseCode}`} onClose={onClose} busy={busy} footer={<div className={styles.dialogActions}><Button tone="secondary" disabled={busy} onClick={onClose} data-overlay-dismiss>Hủy</Button><Button disabled={busy || !mutationAllowed || unknown || selected?.state !== 'AVAILABLE'||mode==='change'&&!reason.trim()} onClick={() => void confirm()}>{busy ? 'Đang xử lý…' : mode === 'assign' ? 'Xác nhận phân công' : 'Xác nhận đổi tàu'}</Button></div>}>
    {unknown&&<Notice title="Cần đối chiếu phân công" tone="warning">Chưa xác định được kết quả. Đóng hộp thoại và tải lại hồ sơ trước khi gửi lại.</Notice>}
    {detail.ship && <Notice title={`Tàu hiện tại · ${detail.ship.shipName}`} tone="warning"><p>{detail.ship.status} · {detail.ship.totalCapacity} khách{detail.bookingHasData ? ' · Đã có đặt chỗ; cần đối chiếu tác động khi đổi tàu.' : ''}</p></Notice>}
    {!detail.ship&&<Notice title={`Tàu hiện tại · ${currentShipName}`}>{detail.shipAssignmentContext?.shipCode??'Chưa có mã tàu để đối chiếu.'}</Notice>}
    {!allowed && <Notice title="Chưa thể phân công tàu" tone="warning">{detail.assignmentCapabilities[mode].reason??'Tải lại hồ sơ để kiểm tra quyền và điều kiện phân công hiện hành.'}</Notice>}
    {mode==='change'&&<Field htmlFor="ship-change-reason" label="Lý do đổi tàu"><textarea id="ship-change-reason" required value={reason} disabled={busy} onChange={event=>setReason(event.target.value)}/></Field>}
    {safety&&<ShipAssignmentDependencies safety={safety}/>}
    {error && <Notice title="Chưa hoàn tất kiểm tra hoặc phân công" tone="error"><p>{error}</p>{!unknown&&allowed&&<Button tone="secondary" disabled={busy} onClick={()=>{setCandidates(null);setSelectedId('');setError('');setAttempt(value=>value+1)}}>Tải lại danh sách tàu</Button>}</Notice>}
    {candidates?.length===0&&<Notice title="Chưa có tàu để chọn">Danh sách không có tàu khác phù hợp để kiểm tra. Bộ phận quản lý tàu cần cập nhật hồ sơ và khả dụng tàu.</Notice>}
    {canInspect&&!candidates && !error ? <Loading label="Đang kiểm tra các tàu…" /> : <div className={styles.candidates} role="radiogroup" aria-label="Chọn tàu">
      {candidates?.map((candidate,index) => <button type="button" role="radio" disabled={busy||!canInspect} tabIndex={selectedId===candidate.ship.shipId||!selectedId&&index===0?0:-1} aria-checked={selectedId === candidate.ship.shipId} className={`${styles.candidate} ${selectedId === candidate.ship.shipId ? styles.candidateSelected : ''}`} key={candidate.ship.shipId} onClick={() => setSelectedId(candidate.ship.shipId)} onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return
        event.preventDefault();const options=candidates??[];if(!options.length)return
        const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+options.length)%options.length
        setSelectedId(options[next].ship.shipId);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
      }}>
        <span className={styles.candidateHeading}><strong>{candidate.ship.shipName} · {candidate.ship.shipCode}</strong><Badge label={stateLabel(candidate.state)} tone={candidateTone(candidate.state)} /></span>
        <span>{candidate.reasons.join(' ')}</span>
        <span>Trạng thái tàu: {({DRAFT:'Đang thiết lập',READY:'Sẵn sàng khai thác',IN_SERVICE:'Đang khai thác',MAINTENANCE:'Đang bảo trì',SUSPENDED:'Tạm dừng khai thác',RETIRED:'Đã ngừng khai thác'} as Record<string,string>)[candidate.ship.status]??'Chưa xác định'}</span>
        {candidate.compatibility&&<span>Boong: {candidate.compatibility.decksCount??'Chưa rõ'} · Cabin: {candidate.compatibility.cabinsCount??'Chưa rõ'} · Sức chứa hành khách của tàu: {candidate.compatibility.totalCapacity??'Chưa rõ'} · Kiểm tra sức chứa hiện hành: {candidate.compatibility.capacitySufficient===null?'Chưa xác định':candidate.compatibility.capacitySufficient?'Đáp ứng':'Không đáp ứng'} · Hành khách đang giữ/đặt chỗ: {candidate.compatibility.bookedPassengersCount??'Chưa rõ'}</span>}
        {candidate.impact&&<span>Phân bổ cabin bị ảnh hưởng: {candidate.impact.affectedCabinAssignmentsCount??'Chưa rõ'} · Hoạt động: {candidate.impact.affectedOnboardActivitiesCount??'Chưa rõ'}</span>}
      </button>)}
    </div>}
    {selected && <Notice title={`Tàu đã chọn · ${selected.ship.shipName} · ${selected.ship.shipCode}`} tone={candidateTone(selected.state)}><p>{stateLabel(selected.state)} · {selected.reasons.join(' ')}</p></Notice>}

  </Modal>
}
