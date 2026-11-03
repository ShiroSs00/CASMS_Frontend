import {useCallback} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {Button,Loading,Modal,Notice} from '@/shared/ui'
import {TemplateSchedule} from '@/domain/itinerary-day'
import {usePlanning} from '../hooks'
import {versionContext} from '../model/version-context'
import { versionLabels, type Trip } from '../model/plan'

export function PublishedTemplateDialog({trip,onClose}:{trip:Trip;onClose:()=>void}){
 const {gateway}=usePlanning()
 const query=useReadQuery(`published-template:${gateway.mode}:${trip.tripId}:${trip.revision}`,useCallback(async signal=>{
  const actual=await gateway.getTrip(trip.tripId,signal)
  const published=versionContext(actual.versions).published
  if(!published)throw new ApiError('Chuyến đi chưa có mẫu lịch trình đã chốt.',409)
  const version=await gateway.version(published.versionId,signal)
  if(version.versionId!==published.versionId||version.tripId!==trip.tripId||version.status!=='PUBLISHED')throw new ApiError('Phiên bản đã thay đổi. Tải lại để đối chiếu mẫu đã chốt.',409)
  return version
 },[gateway,trip.tripId]))
 return <Modal large title={trip.name} protectChanges={false} onClose={onClose} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
  {query.loading&&<Loading label="Đang tải mẫu lịch trình…"/>}
  {query.error&&<Notice title="Chưa xem được mẫu lịch trình" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại mẫu</Button></Notice>}
  {query.data&&!query.loading&&!query.error&&<><p>Nguồn: {trip.name} · {trip.tripCode}</p><p>Phiên bản lịch trình nguồn: V{query.data.versionNumber} · Lần cập nhật {query.data.revision} · {query.data.days.length} ngày</p><p>Trạng thái: {versionLabels[query.data.status]}</p><p>Công bố lúc: {query.data.publishedAt?new Date(query.data.publishedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có thông tin'} · Người công bố: {query.data.publishedByName??'Chưa có thông tin'}</p><p>Phiên bản đã công bố này được dùng làm nguồn khi tạo chuyến khởi hành. Chuyến đã tạo giữ tham chiếu đến phiên bản nguồn của mình.</p><TemplateSchedule days={query.data.days} stops={query.data.stops} entries={query.data.entries}/></>}
 </Modal>
}
