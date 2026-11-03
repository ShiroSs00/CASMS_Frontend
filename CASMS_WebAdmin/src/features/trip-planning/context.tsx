import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, Loading, Notice } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { liveGateway, failure } from './api/live'
import type { PlanningGateway, Scenario } from './api/gateway'
import styles from './Planning.module.css'

const previewEnabled = import.meta.env.DEV && import.meta.env.MODE === 'trip-preview'
import { Context } from './planning-context'
export function PlanningProvider({children}:{children:ReactNode}) {
  const location=useLocation(),access=useSessionAccess(),preview=location.pathname.startsWith('/preview/trip-planning')
  const [scenario,setScenario]=useState<Scenario>('normal'),[view,setView]=useState<'edit'|'review'>('edit')
  const [loaded,setLoaded]=useState<{scenario:Scenario;gateway:PlanningGateway}|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  const unsavedRef=useRef(false)
  useEffect(()=>{if(!preview||!previewEnabled)return;let active=true;void import('./api/preview').then(module=>{if(active){setLoaded({scenario,gateway:module.createPreviewGateway(scenario)});setError('')}}).catch(e=>{if(active)setError(failure(e).message)});return()=>{active=false}},[preview,scenario,attempt])
  if(preview&&!previewEnabled)return <Notice title="Bản thử giao diện chưa được bật">Khởi động FE bằng chế độ trip-preview để mở bản thử.</Notice>
  const gateway=preview?(loaded?.scenario===scenario?loaded.gateway:null):liveGateway
  const can=(permission:string)=>{
    if(!preview)return access.canDo(permission)
    if(permission==='TRIP_READ')return true
    if(gateway?.readOnly)return false
    return view==='review'?['TRIP_PLAN_VALIDATE','TRIP_PLAN_REVIEW'].includes(permission):permission!=='TRIP_PLAN_REVIEW'
  }
  return <AdminShell><div className={styles.workspace}>
    {preview&&<section className={styles.preview} aria-label="Chế độ minh họa"><strong>Bản thử giao diện — dữ liệu minh họa</strong><span>Không kết nối API thật. Dữ liệu chỉ tồn tại trong lượt mở này, không thay đổi phiên đăng nhập hoặc quyền hệ thống.</span><div className={styles.row}><label>Kịch bản <select value={scenario} onChange={e=>{if(unsavedRef.current&&!window.confirm('Đổi kịch bản sẽ bỏ bản nhập minh họa. Tiếp tục?'))return;setScenario(e.target.value as Scenario);unsavedRef.current=false;if(e.target.value==='422')setView('review')}}>{(['normal','loading','empty','error','409','422','readonly'] as Scenario[]).map(value=><option key={value} value={value}>{({normal:'Bình thường',loading:'Đang tải',empty:'Trống',error:'Mất kết nối','409':'Xung đột 409','422':'Vi phạm 422',readonly:'Chỉ đọc'})[value]}</option>)}</select></label><label>Góc nhìn minh họa <select value={view} onChange={e=>setView(e.target.value as 'edit'|'review')}><option value="edit">Người lập lịch trình</option><option value="review">Người duyệt</option></select></label></div></section>}
    {error?<Notice title="Chưa mở được bản thử" tone="error">{error}<Button onClick={()=>setAttempt(n=>n+1)}>Thử lại</Button></Notice>:!gateway?<Loading label="Đang mở bản thử giao diện…"/>:<Context value={{gateway,root:preview?'/preview/trip-planning':'/admin/trips',can,actorId:preview?(view==='edit'?'preview-editor':'preview-reviewer'):access.userId??'',unsavedRef}}>{children}</Context>}
  </div></AdminShell>
}
