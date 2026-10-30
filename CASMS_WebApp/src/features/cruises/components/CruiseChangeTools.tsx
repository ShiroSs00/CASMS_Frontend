import {useSessionAccess} from '@/shared/auth'
import {useId,useState} from 'react'
import {Button,Panel} from '@/shared/ui'
import type {CruiseRecord} from '../model/cruise-record'
import {DepartureImpact,DepartureAudit} from './DepartureData'
import styles from './DeparturePreparation.module.css'

export function CruiseChangeTools({cruise,onChanged}:{cruise:CruiseRecord;onChanged:()=>void}){
 const access=useSessionAccess()
 const [view,setView]=useState<'preview'|'tasks'|'history'|null>(null),contentId=useId()
 if(!access.roles.includes('OPERATIONS_MANAGER')||!access.has('CRUISE_READ'))return null
 return <Panel title="Thay đổi lịch và theo dõi xử lý">

  <div className={styles.actionGroup}>
   {([['preview','Đánh giá thay đổi ngày, cảng hoặc tàu'],['tasks','Xem công việc xử lý'],['history','Xem lịch sử và thông báo']] as const).map(([key,label])=><Button key={key} tone="secondary" aria-expanded={view===key} aria-controls={contentId} onClick={()=>setView(current=>current===key?null:key)}>{view===key?'Đóng · ':''}{label}</Button>)}
  </div>
  <div id={contentId} className={styles.content}>
   {(view==='preview'||view==='tasks')&&<DepartureImpact key={view} cruise={cruise} onChanged={onChanged} view={view}/>}
   {view==='history'&&<DepartureAudit cruise={cruise}/>}
  </div>
 </Panel>
}
