import { useCallback } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Loading, Notice, Panel } from '@/shared/ui'
export { DepartureManifestWorkspace } from './DepartureManifestWorkspace'

export type ManifestPassenger = { bookingPassengerId:string; fullName:string; bookingCode:string; bookingStatus:string; cabinNumber:string|null; deckName:string|null; checkinStatus:string|null }
import {checkinLabels} from './labels'
const bookingLabels:Record<string,string> = { Draft:'Chờ xác nhận', Confirmed:'Đã xác nhận', Cancelled:'Đã hủy' }
function decodeManifest(value:unknown,cruiseId:string):{cruiseName:string;cruiseCode:string;passengers:ManifestPassenger[]} {
  if(!value||typeof value!=='object')throw new Error('Chưa đọc được danh sách hành khách.')
  const row=value as Record<string,unknown>
  if(row.cruiseId!==cruiseId||typeof row.cruiseName!=='string'||typeof row.cruiseCode!=='string'||!Array.isArray(row.passengerList))throw new Error('Danh sách hành khách không thuộc chuyến đã chọn.')
  const rows=row.passengerList.map((item:unknown)=>{
    if(!item||typeof item!=='object')throw new Error('Hồ sơ hành khách chưa hợp lệ.')
    const p=item as Record<string,unknown>
    if(['bookingPassengerId','fullName','bookingCode','bookingStatus'].some(k=>typeof p[k]!=='string'||!(p[k] as string).trim())||['cabinNumber','deckName','checkinStatus'].some(k=>p[k]!=null&&typeof p[k]!=='string'))throw new Error('Hồ sơ hành khách chưa đầy đủ.')
    // Project only the fields needed by this view; never carry document numbers.
    return {bookingPassengerId:p.bookingPassengerId as string,fullName:p.fullName as string,bookingCode:p.bookingCode as string,bookingStatus:p.bookingStatus as string,cabinNumber:p.cabinNumber as string|null??null,deckName:p.deckName as string|null??null,checkinStatus:p.checkinStatus as string|null??null}
  })
  if(new Set(rows.map(p=>p.bookingPassengerId)).size!==rows.length)throw new Error('Danh sách hành khách có bản ghi trùng. Tải lại để đối chiếu.')
  return {cruiseName:row.cruiseName,cruiseCode:row.cruiseCode,passengers:rows}
}
export function CruisePassengerManifest({cruiseId,onSelectPassenger,refreshKey=0}:{cruiseId:string;onSelectPassenger?:(person:ManifestPassenger)=>void;refreshKey?:number}) {
  const access=useSessionAccess(),allowed=access.status==='ready'&&access.canDo('CRUISE_MANIFEST_READ')
  const query=useReadQuery(`manifest:${access.userId}:${cruiseId}:${allowed}:${refreshKey}`,useCallback(async signal=>allowed?decodeManifest(await apiRequest(`/cruise/${encodeURIComponent(cruiseId)}/manifest`,{signal}),cruiseId):null,[cruiseId,allowed]))
  if(!allowed)return <Notice title="Chưa có quyền xem danh sách hành khách">{access.status==='loading'?'Đang kiểm tra quyền…':'Cần quyền xem manifest chuyến khởi hành. Quyền Check-in không thay thế quyền đọc danh sách này.'}</Notice>
  return <Panel title="Danh sách hành khách của chuyến">
    {query.loading&&<Loading label="Đang tải hành khách…"/>}
    {query.error&&<Notice title={query.error instanceof ApiError&&query.error.status===403?'Chưa được phép xem hành khách chuyến này':'Chưa tải được hành khách'} tone="error">{query.error instanceof ApiError&&query.error.status===403?'Kiểm tra quyền đọc danh sách và phân công chuyến còn hiệu lực với người quản lý.':query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}
    {!query.loading&&!query.error&&query.data&&<><h3>{query.data.cruiseName}</h3><p>{query.data.cruiseCode}</p>{query.data.passengers.length?<DataTable label="Hành khách của chuyến khởi hành" headers={['Hành khách','Đặt chỗ','Trạng thái đặt chỗ','Cabin','Boong','Check-in',...(onSelectPassenger?['Thao tác']:[])]}>
      {query.data.passengers.map(p=><tr key={p.bookingPassengerId}><td>{p.fullName}</td><td>{p.bookingCode}</td><td>{bookingLabels[p.bookingStatus]??'Trạng thái chưa được hỗ trợ'}</td><td>{!p.cabinNumber||p.cabinNumber==='UNASSIGNED'?'Chưa phân Cabin':p.cabinNumber==='ASSIGNED'?'Đã phân Cabin · chưa có số':p.cabinNumber}</td><td>{!p.deckName||['N/A','MAIN'].includes(p.deckName)?'Chưa có thông tin boong':p.deckName}</td><td>{p.checkinStatus?checkinLabels[p.checkinStatus]??'Trạng thái chưa được hỗ trợ':'Chưa có trạng thái'}</td>{onSelectPassenger&&<td><Button tone="secondary" onClick={()=>onSelectPassenger(p)}>Xem thủ tục</Button></td>}</tr>)}
    </DataTable>:<Empty title="Chưa có hành khách trong chuyến"/>}</>}
    <Button tone="secondary" disabled={query.loading} onClick={query.retry}>Tải lại danh sách</Button>
    <p>Check-in, sẵn sàng lên tàu và đã lên tàu là các bước riêng. API manifest hiện chưa trả trạng thái boarding của từng hành khách.</p>
  </Panel>
}
