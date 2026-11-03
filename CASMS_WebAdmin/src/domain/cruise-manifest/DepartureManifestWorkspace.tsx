import { useCallback, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Loading, Notice, Panel } from '@/shared/ui'
import { CruisePassengerManifest, type ManifestPassenger } from './index'

type Departure={cruiseId:string;cruiseCode:string;cruiseName:string}
export function DepartureManifestWorkspace({renderCheckin,renderDeparture}:{renderCheckin?:(person:ManifestPassenger,onChanged:()=>void)=>ReactNode;renderDeparture?:(cruiseId:string)=>ReactNode}) {
  const access=useSessionAccess(),[params,setParams]=useSearchParams()
  const cruiseId=params.get('cruiseId')??'',pageValue=Number(params.get('page')??0),page=Number.isSafeInteger(pageValue)&&pageValue>=0?pageValue:0
  const allowed=access.status==='ready'&&access.canDo('CRUISE_READ')
  const [selection,setSelection]=useState<{cruiseId:string;person:ManifestPassenger}|null>(null),[refresh,setRefresh]=useState(0)
  const query=useReadQuery(`manifest-departures:${access.userId}:${allowed}:${page}`,useCallback(async signal=>{
    if(!allowed)return null
    const data=await apiRequest<{content:Departure[];totalPages:number}>('/cruise',{signal,query:{page,size:20}})
    if(!data||!Array.isArray(data.content)||!Number.isSafeInteger(data.totalPages)||data.totalPages<0||data.content.some(c=>!c||['cruiseId','cruiseCode','cruiseName'].some(k=>typeof c[k as keyof Departure]!=='string'||!c[k as keyof Departure].trim())))throw new Error('Chưa đọc được danh sách chuyến khởi hành.')
    return data
  },[allowed,page]))
  const choose=(id:string)=>{const next=new URLSearchParams(params);if(id)next.set('cruiseId',id);else next.delete('cruiseId');setParams(next,{preventScrollReset:true});setSelection(null)}
  const go=(nextPage:number)=>{const next=new URLSearchParams(params);next.set('page',String(nextPage));setParams(next,{preventScrollReset:true})}
  return <>
    {!allowed&&<Notice title="Chưa có quyền xem chuyến khởi hành">{access.status==='loading'?'Đang kiểm tra quyền…':'Cần quyền đọc chuyến khởi hành để tra cứu hành khách theo chuyến.'}</Notice>}
    {!cruiseId&&allowed&&<Panel title="Chọn chuyến khởi hành">
      {query.loading&&<Loading label="Đang tải chuyến khởi hành…"/>}
      {query.error&&<Notice title="Chưa tải được chuyến" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}
      {!query.loading&&!query.error&&query.data&&(query.data.content.length?<><DataTable label="Chuyến khởi hành" headers={['Tên chuyến','Mã chuyến','Thao tác']}>{query.data.content.map(c=><tr key={c.cruiseId}><td>{c.cruiseName}</td><td>{c.cruiseCode}</td><td><Button tone="secondary" onClick={()=>choose(c.cruiseId)}>Xem hành khách</Button></td></tr>)}</DataTable><Button tone="secondary" disabled={page===0} onClick={()=>go(page-1)}>Trang trước</Button><span> Trang {page+1} </span><Button tone="secondary" disabled={page+1>=query.data.totalPages} onClick={()=>go(page+1)}>Trang sau</Button></>:<Empty title="Chưa có chuyến khởi hành"/>)}
    </Panel>}
    {cruiseId&&allowed&&<><Button tone="secondary" onClick={()=>choose('')}>Quay lại danh sách chuyến</Button><CruisePassengerManifest key={cruiseId} cruiseId={cruiseId} refreshKey={refresh} onSelectPassenger={renderCheckin&&access.canDo('CHECKIN_READ')?person=>setSelection({cruiseId,person}):undefined}/>{selection?.cruiseId===cruiseId&&renderCheckin&&renderCheckin(selection.person,()=>setRefresh(value=>value+1))}{renderDeparture?.(cruiseId)}</>}
  </>
}
