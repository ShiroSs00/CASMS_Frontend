import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {Badge,Button,Loading,Modal,Notice,Panel} from '@/shared/ui'
import {TemplateSchedule} from '@/domain/itinerary-day'
import {readPublishedSource,type PublishedSource} from '../api/source-version'
import styles from './Cruises.module.css'

export function SourceScheduleDialog({versionId,source,onClose}:{versionId:string;source?:PublishedSource;onClose:()=>void}){
 const query=useReadQuery(`source-dialog:${versionId}:${source?.revision??''}`,useCallback(signal=>source?Promise.resolve(source):readPublishedSource(versionId,signal,true),[versionId,source]))
 return <Modal large title={query.data?query.data.tripName:'Lịch trình nguồn'} protectChanges={false} onClose={onClose} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
  {query.loading&&<Loading label="Đang tải lịch trình đã chốt…"/>}
  {query.error&&<Notice title="Chưa tải được lịch trình" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại mẫu</Button></Notice>}
  {query.data&&!query.loading&&!query.error&&<><p>{query.data.tripCode} · Phiên bản {query.data.versionNumber} · {query.data.days.length} ngày</p>{query.data.tripStatus==='ARCHIVED'&&<p>Chuyến đi nguồn đã lưu trữ · Chỉ xem lịch trình đã chốt.</p>}{query.data.description&&<p>{query.data.description}</p>}<TemplateSchedule days={query.data.days} stops={query.data.stops} entries={query.data.entries}/></>}
 </Modal>
}

export function InheritedSourcePlan({
 source,
 onChangeSource,
 disabled
}:{
 source:PublishedSource;
 onChangeSource?:()=>void;
 disabled?:boolean;
}){
 const durationLabel=source.durationGroup==='SHORT'
  ?'Chuyến ngắn (1–2 ngày)'
  :source.durationGroup==='LONG'
   ?'Chuyến dài (3–5 ngày)'
   :'Chuyến thông thường'

 const formattedDate=source.publishedAt
  ?new Date(source.publishedAt).toLocaleString('vi-VN',{
    timeZone:'Asia/Ho_Chi_Minh',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    day:'2-digit',
    month:'2-digit',
    year:'numeric'
   })
  :'Chưa có thông tin'

 return <Panel title="Lịch trình được chọn" className={styles.inheritedPlan}>
  <div className={styles.sourceHeader}>
   <h2 className={styles.sourceTripName}>{source.tripName}</h2>
   <Badge tone="success" label="Đã chốt lịch trình" />
  </div>

  <dl className={styles.sourceDetailsList}>
   <div className={styles.sourceDetailRow}>
    <dt>Mã</dt>
    <dd><strong>{source.tripCode}</strong></dd>
   </div>
   <div className={styles.sourceDetailRow}>
    <dt>Người tạo</dt>
    <dd>{source.publishedByName||'cruise_manager'}</dd>
   </div>
   <div className={styles.sourceDetailRow}>
    <dt>Ngày tạo</dt>
    <dd>{formattedDate}</dd>
   </div>
   <div className={styles.sourceDetailRow}>
    <dt>Loại chuyến</dt>
    <dd>{durationLabel}</dd>
   </div>
   <div className={styles.sourceDetailRow}>
    <dt>Trạng thái</dt>
    <dd><Badge tone="success" label="Đã chốt lịch trình" /></dd>
   </div>
  </dl>

  <div className={styles.sourceActions}>
   {onChangeSource&&<Button tone="secondary" disabled={disabled} onClick={onChangeSource}>Đổi lịch trình khác</Button>}
  </div>
 </Panel>
}
