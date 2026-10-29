import {useCallback,useRef,useState} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {Badge,Button,Field,Loading,Modal,Notice,Panel} from '@/shared/ui'
import {cruiseApi} from '../api/cruise-api'
import {departureApi} from '../api/departure-api'
import {decodeSaleReadiness} from '../model/departure-contract'
import {useReadinessClock} from '../hooks/useReadinessClock'
import type {CruiseRecord} from '../model/cruise-record'
type Scope='WHOLE_CRUISE'|'CABIN_ONLY'|'SELECTED_PACKAGES'
export function CruiseSale({cruise}:{cruise:CruiseRecord}){
 const access=useSessionAccess(),[scope,setScope]=useState<Scope>('WHOLE_CRUISE'),[selected,setSelected]=useState<string[]>([]),[epoch,setEpoch]=useState(0),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const selection=scope==='SELECTED_PACKAGES'?[...selected].sort().join(','):undefined,key=JSON.stringify([cruise.cruiseId,scope,selection,epoch,cruise.revision])
 const query=useReadQuery(`scoped-sale:${key}`,useCallback(signal=>apiRequest(`/cruise/${cruise.cruiseId}/sale-readiness`,{query:{saleScope:scope,selectedPackageIds:selection},signal}).then(value=>decodeSaleReadiness(value,cruise.cruiseId)),[cruise.cruiseId,scope,selection]))
 const packages=useReadQuery(`scoped-sale-packages:${cruise.cruiseId}`,useCallback(signal=>cruiseApi.listPackages(cruise.cruiseId,signal),[cruise.cruiseId]))
 const sellability=useReadQuery(`scoped-sale-state:${cruise.cruiseId}:${epoch}`,useCallback(signal=>departureApi.publicSellability(cruise.cruiseId,signal),[cruise.cruiseId]))
 const data=query.data,now=useReadinessClock(data?.validUntil),expired=!data?.validUntil||Date.parse(data.validUntil)<=now,blocked=!data?.ready||!data.fingerprint||data.cruiseRevision==null||Boolean(data.blockers?.length)||expired||(scope==='SELECTED_PACKAGES'&&!selected.length)
 const saleKeys:Record<string,string>={OPEN_FOR_SALE:'OPEN',NOT_YET_OPEN:'NOT_OPEN',DRAFT:'NOT_OPEN',STOPPED:'STOPPED',SOLD_OUT:'SOLD_OUT'}
 async function open(){
  if(!data||blocked||lock.current||uncertain||!access.roles.includes('OPERATIONS_MANAGER')||!access.has('CRUISE_OPEN_SALE'))return
  lock.current=true;setBusy(true);setError('')
  try{
   const saved=await apiRequest<{cruiseId:string;revision:number}>(`/cruise/${cruise.cruiseId}/open-sale`,{method:'POST',body:{expectedRevision:data.cruiseRevision,saleScope:scope,packageIds:scope==='SELECTED_PACKAGES'?selected:[],fingerprint:data.fingerprint,eventIdentity:crypto.randomUUID()}})
   const actual=await departureApi.publicSellability(cruise.cruiseId)
   if(saved.cruiseId!==cruise.cruiseId||actual.sellable!==true||actual.saleState!=='OPEN_FOR_SALE')throw new ApiError('',502)
   setConfirm(false);setEpoch(n=>n+1)
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <Panel title={businessCopy('cruise.sale.check')}>
  {sellability.data&&<Badge label={domainStatus('cruise.sale',saleKeys[sellability.data.saleState??'']??'UNKNOWN')}/>}
  <Field htmlFor="sale-scope" label={businessCopy('cruise.sale.scope')}><select id="sale-scope" disabled={busy} value={scope} onChange={e=>{setScope(e.target.value as Scope);setConfirm(false)}}><option value="WHOLE_CRUISE">Toàn bộ chuyến</option><option value="CABIN_ONLY">Chỉ cabin</option><option value="SELECTED_PACKAGES">Cabin và gói được chọn</option></select></Field>
  {scope==='SELECTED_PACKAGES'&&packages.data?.map(p=><label key={p.tourPackageId}><input type="checkbox" checked={selected.includes(p.tourPackageId)} disabled={busy} onChange={e=>{setSelected(old=>e.target.checked?[...old,p.tourPackageId]:old.filter(id=>id!==p.tourPackageId));setConfirm(false)}}/>{p.packageName}</label>)}
  {(query.loading||packages.loading||sellability.loading)&&<Loading/>}
  {(query.error||packages.error||sellability.error)&&<Notice title="Không thể hoàn tất thao tác"><Button onClick={()=>{query.retry();packages.retry();sellability.retry()}}>Tải lại dữ liệu</Button></Notice>}
  {data?.blockers?.length?<ul>{data.blockers.map(code=><li key={code}>{businessErrorMessage(code,'')}</li>)}</ul>:null}
  {blocked&&<Notice title={businessCopy('cruise.sale.BLOCKED')}>{data?.blockers?.includes('PRICING_APPROVER_UNRESOLVED')&&businessErrorMessage('PRICING_APPROVER_UNRESOLVED','')}{expired&&<p>Kết quả kiểm tra đã hết hạn hoặc chưa có thời hạn xác nhận. Cần kiểm tra lại.</p>}</Notice>}
  <Button disabled={busy} onClick={()=>{setEpoch(n=>n+1);setConfirm(false)}}>{businessCopy('cruise.sale.check')}</Button>
  {access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_OPEN_SALE')&&<Button disabled={busy||uncertain||blocked||query.loading||Boolean(query.error||packages.error)} onClick={()=>setConfirm(true)}>{businessCopy('cruise.sale.OPEN_ACTION')}</Button>}
  {error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
  {confirm&&<Modal title={businessCopy('cruise.sale.OPEN_ACTION')} onClose={()=>{if(!busy)setConfirm(false)}}><p>{cruise.cruiseCode} · Phiên bản {data?.cruiseRevision}</p><Button disabled={busy||blocked||uncertain} onClick={()=>void open()}>{businessCopy('cruise.sale.OPEN_ACTION')}</Button></Modal>}
 </Panel>
}
