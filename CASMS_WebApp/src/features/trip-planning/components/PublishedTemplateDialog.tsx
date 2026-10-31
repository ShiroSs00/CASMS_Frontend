import {useCallback} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {Button,Loading,Modal,Notice} from '@/shared/ui'
import {TemplateSchedule} from '@/domain/itinerary-day'
import {usePlanning} from '../hooks'
import {versionContext} from '../model/version-context'
import type {Trip} from '../model/plan'

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
 return <Modal large title={`Lịch trình đã chốt · ${trip.name}`} protectChanges={false} onClose={onClose} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
  {query.loading&&<Loading label="Đang tải mẫu lịch trình…"/>}
  {query.error&&<Notice title="Chưa xem được mẫu lịch trình" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại mẫu</Button></Notice>}
  {query.data&&!query.loading&&!query.error&&<><p>{trip.tripCode} · Phiên bản {query.data.versionNumber} · {query.data.days.length} ngày</p><TemplateSchedule days={query.data.days} stops={query.data.stops} entries={query.data.entries}/></>}
 </Modal>
}
