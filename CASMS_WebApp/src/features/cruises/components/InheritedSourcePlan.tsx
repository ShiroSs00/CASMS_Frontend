import {Badge,Notice,Panel,PermissionLink} from '@/shared/ui'
import {businessCopy} from '@/shared/i18n/business-copy'
import {SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import type {PublishedSource} from '../api/source-version'
import styles from './Cruises.module.css'
const kinds={ONBOARD_ACTIVITY:'Hoạt động trên tàu',SHORE_EXCURSION:'Tour tham quan trên bờ',SERVING_WINDOW:'Khung phục vụ'}
const clock=(value:string|null)=>value?(value.length>5&&value.endsWith(':00')?value.slice(0,5):value):'Chưa có giờ'
export function InheritedSourcePlan({source}:{source:PublishedSource}){
 return <Panel title="Hành trình kế thừa" className={styles.inheritedPlan}>
   <div className={styles.sourceIdentity}><Badge label={businessCopy('trip.template.PUBLISHED')} tone="success"/><span>{source.tripCode} · Phiên bản {source.versionNumber}</span><h2>{source.tripName}</h2></div>
   {source.description&&<p className={styles.sourceDescription}>{source.description}</p>}
   {source.days.some(day=>day.shipTimeZoneId!==SHIP_TIME_ZONE)&&<Notice title="Cần đối chiếu giờ tàu của nguồn" tone="warning">Múi giờ ngày trong nguồn chưa khớp giờ tàu Việt Nam. Không tự quy đổi giờ địa phương thành lịch khởi hành.</Notice>}
   <p className={styles.muted}>{source.days.length} ngày · {source.stops.length} lần ghé cảng · {source.entries.length} mục chương trình</p>
   <ol className={styles.inheritedDays}>{source.days.toSorted((a,b)=>a.dayNumber-b.dayNumber).map(day=>{
     const stops=source.stops.filter(v=>v.arrivalDayNumber<=day.dayNumber&&v.departureDayNumber>=day.dayNumber).toSorted((a,b)=>a.stopOrder-b.stopOrder)
     const entries=source.entries.filter(v=>v.startDayNumber<=day.dayNumber&&v.endDayNumber>=day.dayNumber)
     return <li key={day.dayNumber}><div className={styles.sourceDayHeading}><strong>Ngày {day.dayNumber}</strong><span>{day.dayType==='SEA_DAY'?'Trên biển':day.dayType==='PORT_DAY'?'Ghé cảng':'Chưa xác định loại ngày'}</span></div>{day.title&&<h3>{day.title}</h3>}
       {stops.map(stop=><p key={stop.clientKey}><strong>Lần ghé {stop.stopOrder} · {stop.portName||'Chưa có tên cảng'}</strong><br/>Ngày {stop.arrivalDayNumber} {clock(stop.plannedArrivalTime)} → Ngày {stop.departureDayNumber} {clock(stop.plannedDepartureTime)} <small>· giờ cảng{stop.timeZoneId?' · '+stop.timeZoneId:''}</small></p>)}
       {entries.length>0&&<details open={entries.length<=3}><summary>Chương trình theo nguồn · {entries.length} mục</summary><ul>{entries.map(entry=><li key={entry.clientKey}><span>{kinds[entry.kind]}</span><strong>{entry.title}</strong><p>Ngày {entry.startDayNumber} {clock(entry.plannedStartTime)} → Ngày {entry.endDayNumber} {clock(entry.plannedEndTime)} · {entry.kind==='SHORE_EXCURSION'?'giờ cảng':'giờ Việt Nam'}</p>{entry.locationText&&<p>{entry.locationText}</p>}</li>)}</ul></details>}
     </li>
   })}</ol>
   <PermissionLink target="_blank" rel="noopener noreferrer" to={'/admin/trips/'+encodeURIComponent(source.tripId)+'/schedule?versionId='+encodeURIComponent(source.versionId)}>Xem toàn bộ phiên bản nguồn</PermissionLink>
 </Panel>
}
