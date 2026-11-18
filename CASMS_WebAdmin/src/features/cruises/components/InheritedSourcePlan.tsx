import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {Button,Loading,Modal,Notice} from '@/shared/ui'
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
 onPreviewSource?:()=>void;
 onChangeSource?:()=>void;
 disabled?:boolean;
}){
 const day1=source.days.find(d=>d.dayNumber===1)
 const sortedStops=[...source.stops].sort((a,b)=>a.stopOrder-b.stopOrder)
 const firstStop=sortedStops[0]
 const lastStop=sortedStops.find(s=>s.isDisembarkation)??sortedStops[sortedStops.length-1]
 const departurePortLabel=day1?.departurePortName??(day1?.dayType==='SEA_DAY'?'Chọn cảng khi tạo tour':firstStop?.portName)??'Chưa xác định'
 const returnPortLabel=lastStop?.portName??'Chưa xác định'

 return <div className={styles.sourceSummaryBlock}>
  <div className={styles.departureSourceHeader}>
   <div>
    <p className={styles.sourceEyebrow}>TUYẾN MẪU ĐÃ CHỌN</p>
    <h2 className={styles.sourceSummaryTitle}>{source.tripName}</h2>
    <p className={styles.sourceSummaryMeta}>
     {source.tripCode} · {source.durationDays} ngày{source.durationNights ? ` ${source.durationNights} đêm` : ''}
    </p>
   </div>
   {onChangeSource&&<Button type="button" tone="secondary" size="compact" autoWidth disabled={disabled} onClick={onChangeSource}>Đổi lịch trình mẫu</Button>}
  </div>
  <dl className={styles.departureSourceRoute}>
    <div><dt>Cảng đi</dt><dd>{departurePortLabel}</dd></div>
    <div><dt>Cảng cuối</dt><dd>{returnPortLabel}</dd></div>
  </dl>
 </div>
}
