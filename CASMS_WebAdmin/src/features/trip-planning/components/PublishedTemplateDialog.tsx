import {useCallback} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {Badge,Button,Loading,Modal,Notice} from '@/shared/ui'
import {TemplateSchedule} from '@/domain/itinerary-day'
import {usePlanning} from '../hooks'
import {versionContext} from '../model/version-context'
import type { Trip } from '../model/plan'

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

 const formattedDate = query.data?.publishedAt
  ? new Date(query.data.publishedAt).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  : 'Chưa có thông tin'

 const durationLabel = trip.info.durationBand === 'SHORT'
  ? 'Chuyến ngắn (1–2 ngày)'
  : trip.info.durationBand === 'LONG'
  ? 'Chuyến dài (3–5 ngày)'
  : `${trip.durationDays} ngày`

 return <Modal large title={trip.name} protectChanges={false} onClose={onClose} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
  {query.loading&&<Loading label="Đang tải mẫu lịch trình…"/>}
  {query.error&&<Notice title="Chưa xem được mẫu lịch trình" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại mẫu</Button></Notice>}
  {query.data&&!query.loading&&!query.error&&(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Mã</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{trip.tripCode}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Người tạo</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{query.data.publishedByName ?? 'cruise_manager'}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Ngày tạo</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{formattedDate}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Loại chuyến</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{durationLabel}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Trạng thái</div>
          <div style={{ marginTop: '2px' }}><Badge tone="success" label="Đã chốt lịch trình" /></div>
        </div>
      </div>
      {trip.status==='ARCHIVED'&&<p style={{ color: '#b45309', marginBottom: '12px' }}>Chuyến đi nguồn đã lưu trữ · Chỉ xem lịch trình đã chốt.</p>}
      {trip.info.description&&<p style={{ marginBottom: '16px' }}>{trip.info.description}</p>}
      <TemplateSchedule days={query.data.days} stops={query.data.stops} entries={query.data.entries}/>
    </>
  )}
 </Modal>
}
