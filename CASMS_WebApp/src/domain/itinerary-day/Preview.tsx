import {useId,useState,type ReactNode} from 'react'
import {itineraryDayRole,itineraryDayRoleLabels} from './roles'
import styles from './Preview.module.css'

type PreviewDay={dayNumber:number;title?:string|null;calendarDate?:string|null}
export function ItineraryDayBrowser({days,children}:{days:readonly PreviewDay[];children:(dayNumber:number)=>ReactNode}){
 const [selected,setSelected]=useState(days[0]?.dayNumber??1),id=useId()
 const current=days.find(day=>day.dayNumber===selected)??days[0]
 if(!current)return <p>Chưa có ngày trong lịch trình.</p>
 return <div className={styles.layout}>
  <nav className={styles.days} aria-label="Ngày trong lịch trình">{days.toSorted((a,b)=>a.dayNumber-b.dayNumber).map(day=><button key={day.dayNumber} type="button" aria-current={current.dayNumber===day.dayNumber?'true':undefined} aria-controls={id} onClick={()=>setSelected(day.dayNumber)}><strong>Ngày {day.dayNumber}</strong><span>{day.calendarDate?day.calendarDate.split('-').reverse().join('/'):day.title&&day.title!==`Ngày ${day.dayNumber}`?day.title:itineraryDayRoleLabels[itineraryDayRole(day.dayNumber,days.length)]}</span></button>)}</nav>
  <section id={id} className={styles.content} aria-label={`Lịch trình ngày ${current.dayNumber}`}>{children(current.dayNumber)}</section>
 </div>
}
type Stop={clientKey:string;portName?:string;stopOrder:number;arrivalDayNumber:number;departureDayNumber:number;plannedArrivalTime:string|null;plannedDepartureTime:string|null;timeZoneId?:string;allAboardDayNumber?:number|null;allAboardTime?:string|null;isEmbarkation?:boolean;isDisembarkation?:boolean;arrivalMethod?:string;callType?:string}
type Entry={clientKey:string;title:string;kind:string;startDayNumber:number;endDayNumber:number;plannedStartTime:string;plannedEndTime:string;timeZoneId:string;locationText:string|null;meetingPoint:string|null;notes?:string|null;displayLocation?:string|null;categoryName?:string|null;referenceShipName?:string|null}
type Day=PreviewDay&{dayType:string|null;description?:string|null;departurePortName?:string|null;plannedDepartureTime?:string|null}
const clock=(value:string|null|undefined)=>value?(value.endsWith(':00')?value.slice(0,5):value):'Chưa có giờ'
const stamp=(day:number,time:string|null|undefined)=>`Ngày ${day} · ${clock(time)}`
const kinds:Record<string,string>={ONBOARD_ACTIVITY:'Hoạt động trên tàu',SHORE_EXCURSION:'Tour tham quan trên bờ',SERVING_WINDOW:'Khung phục vụ'}
export function TemplateSchedule({days,stops,entries}:{days:readonly Day[];stops:readonly Stop[];entries:readonly Entry[]}){
 return <ItineraryDayBrowser days={days}>{number=>{
  const day=days.find(item=>item.dayNumber===number)!
  const calls=stops.filter(stop=>stop.arrivalDayNumber<=number&&stop.departureDayNumber>=number).toSorted((a,b)=>a.stopOrder-b.stopOrder)
  const program=entries.filter(entry=>entry.startDayNumber<=number&&entry.endDayNumber>=number)
  const zones=[...new Set(program.map(entry=>entry.timeZoneId))]
  return <>
   <header className={styles.dayHeading}><h3>Ngày {number}{day.title&&day.title!==`Ngày ${number}`?` · ${day.title}`:''}</h3><p>{itineraryDayRoleLabels[itineraryDayRole(number,days.length)]} · {day.dayType==='SEA_DAY'?'Ngày trên biển':day.dayType==='PORT_DAY'?'Ngày ghé cảng':'Chưa xác định loại ngày'}</p></header>
   {day.description&&<p>{day.description}</p>}
   {number===1&&day.departurePortName&&<p><strong>Khởi hành: {day.departurePortName}</strong> · {clock(day.plannedDepartureTime)} · Giờ Việt Nam</p>}
   <h4>Tuyến trong ngày</h4>
   {!calls.length&&<p>{itineraryDayRoleLabels[itineraryDayRole(number,days.length)]} · {day.dayType==='SEA_DAY'?'Không ghé cảng trong ngày này.':'Chưa có lần ghé cảng.'}</p>}
   {calls.map(stop=><article className={styles.item} key={stop.clientKey}><h4>{stop.stopOrder}. {stop.portName||'Chưa có tên cảng'}</h4><p>Đến: {stamp(stop.arrivalDayNumber,stop.plannedArrivalTime)}</p><p>{stop.isDisembarkation?'Hoàn tất trả khách':'Rời cảng'}: {stamp(stop.departureDayNumber,stop.plannedDepartureTime)}</p><p>Giờ cảng · {stop.timeZoneId||'Chưa xác định múi giờ'}</p>{stop.arrivalMethod&&<p>{stop.arrivalMethod==='BERTH'?'Cập bến':stop.arrivalMethod==='TENDER'?'Trung chuyển bằng tàu nhỏ':'Chưa xác định cách ghé cảng'}</p>}{stop.callType&&stop.callType!=='NORMAL'&&<p>{stop.callType==='OVERNIGHT'?'Ghé qua đêm':stop.callType==='LATE_NIGHT'?'Ghé cảng ban đêm':'Chưa xác định loại lần ghé'}</p>}{(stop.isEmbarkation||stop.isDisembarkation)&&<p>{[stop.isEmbarkation?'Cảng khởi hành':null,stop.isDisembarkation?'Cảng kết thúc':null].filter(Boolean).join(' · ')}</p>}{stop.allAboardTime&&<p>Hạn trở lại tàu: {stamp(stop.allAboardDayNumber??stop.departureDayNumber,stop.allAboardTime)}</p>}</article>)}
   <h4>Chương trình trong ngày</h4>
   {!program.length&&<p>Chưa có hoạt động hoặc tour trong ngày này.</p>}
   {zones.map(zone=><section key={zone} className={styles.program}><h5>{zone==='Asia/Ho_Chi_Minh'?'Giờ Việt Nam':`Giờ địa phương · ${zone||'Chưa xác định múi giờ'}`}</h5>{program.filter(entry=>entry.timeZoneId===zone).toSorted((a,b)=>a.startDayNumber-b.startDayNumber||a.plannedStartTime.localeCompare(b.plannedStartTime)).map(entry=><article className={styles.item} key={entry.clientKey}><span>{kinds[entry.kind]||'Chương trình'}</span><h4>{entry.title}</h4><p>{stamp(entry.startDayNumber,entry.plannedStartTime)} → {stamp(entry.endDayNumber,entry.plannedEndTime)}</p>{(entry.locationText||entry.displayLocation)&&<p>Địa điểm: {entry.locationText||entry.displayLocation}</p>}{entry.categoryName&&<p>{entry.categoryName}</p>}{entry.referenceShipName&&<p>Tàu tham chiếu: {entry.referenceShipName}</p>}{entry.meetingPoint&&<p>Điểm tập trung: {entry.meetingPoint}</p>}{entry.notes&&<p>{entry.notes}</p>}</article>)}</section>)}
  </>
 }}</ItineraryDayBrowser>
}
