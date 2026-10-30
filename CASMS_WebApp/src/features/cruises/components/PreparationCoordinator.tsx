import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {useSessionAccess} from '@/shared/auth'
import {Button,Field,Loading,Notice} from '@/shared/ui'
import {preparationApi,type PreparationDashboard} from '../api/preparation-api'
import styles from './ManagerWorkspace.module.css'
export function PreparationCoordinator({view,onChanged}:{view:PreparationDashboard;onChanged:()=>void}){
 const access=useSessionAccess(),allowed=view.canAssignCoordinator&&access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_STAFF_ASSIGN')
 const [selected,setSelected]=useState(view.coordinatorUserId??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false),lock=useRef(false)
 const candidates=useReadQuery(`prep-coordinators:${access.userId}:${view.cruiseId}:${allowed}`,useCallback(signal=>allowed?preparationApi.candidates(view.cruiseId,signal):Promise.resolve(null),[allowed,view.cruiseId]))
 async function save(event:FormEvent){event.preventDefault();if(!allowed||!selected||lock.current||unknown)return;lock.current=true;setBusy(true);setError('')
  try{await preparationApi.assign(view,selected);onChanged()}catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUnknown(true)}finally{lock.current=false;setBusy(false)}
 }
 return <div className={styles.coordinator}><p>{businessCopy('preparation.coordinator')}: <strong>{view.coordinatorUsername??businessCopy('preparation.coordinator.missing')}</strong></p>
 {allowed&&<details className={styles.coordinatorEditor} open={!view.coordinatorUserId}><summary>{view.coordinatorUserId?'Thay đổi người phụ trách':'Phân công người phụ trách'}</summary>
 {candidates.loading&&<Loading/>}{candidates.error&&<Notice title={businessCopy('preparation.coordinator.loadFailed')}><Button onClick={candidates.retry}>Thử lại</Button></Notice>}
 <form className={styles.coordinatorForm} onSubmit={save}>
 <Field htmlFor="prep-coordinator" label="Chọn người phụ trách hồ sơ"><select id="prep-coordinator" value={selected} disabled={busy||unknown||candidates.loading||Boolean(candidates.error)} onChange={e=>setSelected(e.target.value)} required><option value="">{businessCopy('preparation.coordinator.select')}</option>{candidates.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
 <Button type="submit" disabled={busy||unknown||!selected||selected===view.coordinatorUserId||!candidates.data?.some(c=>c.id===selected)}>{busy?'Đang lưu…':businessCopy('preparation.coordinator.assign')}</Button></form></details>}
 {error&&<Notice tone="error" title={businessCopy('preparation.coordinator.failed')}>{error}</Notice>}{unknown&&<Notice title={businessCopy('preparation.coordinator.unknown')}>{businessCopy('preparation.coordinator.unknown')}</Notice>}
 </div>
}
