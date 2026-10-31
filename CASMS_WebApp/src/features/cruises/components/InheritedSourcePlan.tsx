import {useCallback,useState} from 'react'
import {useReadQuery} from '@/shared/api'
import {Button,Loading,Modal,Notice,Panel} from '@/shared/ui'
import {TemplateSchedule} from '@/domain/itinerary-day'
import {readPublishedSource,type PublishedSource} from '../api/source-version'
import styles from './Cruises.module.css'

export function SourceScheduleDialog({versionId,source,onClose}:{versionId:string;source?:PublishedSource;onClose:()=>void}){
 const query=useReadQuery(`source-dialog:${versionId}:${source?.revision??''}`,useCallback(signal=>source?Promise.resolve(source):readPublishedSource(versionId,signal,true),[versionId,source]))
 return <Modal large title={query.data?`Lịch trình đã chốt · ${query.data.tripName}`:'Lịch trình đã chốt'} protectChanges={false} onClose={onClose} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
  {query.loading&&<Loading label="Đang tải lịch trình đã chốt…"/>}
  {query.error&&<Notice title="Chưa tải được lịch trình" tone="error">{query.error.message}<Button tone="secondary" onClick={query.retry}>Tải lại mẫu</Button></Notice>}
  {query.data&&!query.loading&&!query.error&&<><p>{query.data.tripCode} · Phiên bản {query.data.versionNumber} · {query.data.days.length} ngày</p>{query.data.tripStatus==='ARCHIVED'&&<p>Chuyến đi nguồn đã lưu trữ · Chỉ xem lịch trình đã chốt.</p>}{query.data.description&&<p>{query.data.description}</p>}<TemplateSchedule days={query.data.days} stops={query.data.stops} entries={query.data.entries}/></>}
 </Modal>
}
export function InheritedSourcePlan({source}:{source:PublishedSource}){
 const [open,setOpen]=useState(false)
 return <Panel title="Lịch trình được chọn" className={styles.inheritedPlan}>
  <div className={styles.sourceIdentity}><h2>{source.tripName}</h2><span>{source.tripCode} · Phiên bản {source.versionNumber} · Đã chốt lịch trình</span></div>
  <p>{source.days.length} ngày · {source.stops.length} lần ghé cảng · {source.entries.length} mục chương trình</p>
  <Button tone="secondary" onClick={()=>setOpen(true)}>Xem lịch trình đã chốt</Button>
  {open&&<SourceScheduleDialog versionId={source.versionId} source={source} onClose={()=>setOpen(false)}/>}
 </Panel>
}
