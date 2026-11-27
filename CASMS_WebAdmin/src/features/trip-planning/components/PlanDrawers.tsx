import { projectRoute } from '../model/route-order'
import { useEffect, useState } from 'react'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { validTimeZone } from '@/shared/lib/journey-time'
import { useSources } from '../hooks'
import { countryLabel, domesticRegionLabel, kindLabels, newKey, SHIP_ZONE, shortTime, timeNumber, type Content, type Entry, type Stop, type Source, type TripInfo, type Violation } from '../model/plan'
import styles from '../Planning.module.css'
import { DestinationVisits } from './DestinationVisits'
import { SourcePicker } from './SourcePicker'
import { scheduleDayLabel, stopRoleLabel } from '../model/day-labels'
import { selectEntrySource } from '../model/source-selection'
import { violationTarget, violationFieldId } from '../model/violation-target'
import { EntryDetails, StopDetails } from './PlanDetails'
import { callTypeTimingViolations, callsAfterTerminal, consecutiveSamePortViolations, linkedTourViolations, overlappingStops, portMatchesScope, routeOrderViolations } from '../model/port-rules'

function useViolationField(violation:Violation|undefined,formId:string,readOnly:boolean,allowLocationInstead=false){
  const [dismissed,setDismissed]=useState<Violation|null>(null),target=violation?violationTarget({...violation,entityType:violation.entityType??(formId==='stop-draft'?'STOP':'ENTRY')}):null
  const locationIssue=allowLocationInstead&&violation?.code==='MEETING_POINT_REQUIRED'
  const message=locationIssue?'Bổ sung địa điểm tổ chức hoặc điểm tập trung.':violation?.message
  useEffect(()=>{if(!violation)return;const element=document.getElementById(target?.fieldId??formId);element?.scrollIntoView({block:'center'});if(readOnly)document.getElementById(formId)?.focus();else element?.focus()},[violation,target?.fieldId,formId,readOnly])
  return {dismiss:(event:React.FormEvent<HTMLFormElement>)=>{if(event.target instanceof HTMLElement&&(event.target.id===target?.fieldId||(locationIssue&&event.target.id==='entry-location')||(violation?.code==='CLIENT_STOP_TIME_OVERLAP'&&['stop-arrival-day','stop-arrival','stop-departure-day','stop-departure','stop-port'].includes(event.target.id))))setDismissed(violation??null)},errorFor:(field:string)=>dismissed!==violation&&Boolean(target?.fieldId)&&target?.fieldId===violationFieldId(formId==='stop-draft'?'stops':'entries',field)?message:undefined,notice:dismissed!==violation&&violation?<Notice title="Nội dung cần chỉnh sửa" tone="warning">{message}</Notice>:null}
}

// Hide unnecessary seconds without truncating existing second-precision times.
const timeStep=(value:string|null|undefined)=>value&&/:([0-5]\d)$/.test(value)&&value.length>5&&!value.endsWith(':00')?1:60
const focusError=(id:string)=>requestAnimationFrame(()=>document.getElementById(id)?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus())
type DrawerProps={content:Content;dayNumber:number;readOnly:boolean;onClose:()=>void;violation?:Violation}
type StopDrawerProps={tripId:string;tripRevision:number;tripInfo:TripInfo;stop?:Stop;allAboardOnly?:boolean;onApply:(stop:Stop)=>void}&DrawerProps
type EntryDrawerProps={entry?:Entry;initialStopClientKey?:string;kind:Entry['kind'];onApply:(entries:Entry[])=>void}&DrawerProps

export function StopDrawer(props:StopDrawerProps) {
  return props.readOnly?<StopDetails stop={props.stop} onClose={props.onClose} violation={props.violation}/>:<StopForm {...props}/>
}

function StopForm({content,tripId,tripRevision,tripInfo,dayNumber,readOnly,stop,allAboardOnly=false,onClose,onApply,violation}:StopDrawerProps) {
  const server=useViolationField(violation,'stop-draft',readOnly)
  const [initialSnapshot]=useState<Stop>(()=>{
    const initial:Stop=structuredClone(stop??{clientKey:newKey(),portId:'',portName:'',stopOrder:Math.max(0,...content.stops.map(s=>s.stopOrder))+1,arrivalDayNumber:dayNumber,plannedArrivalTime:'',departureDayNumber:dayNumber,plannedDepartureTime:'',callType:'NORMAL',arrivalMethod:'BERTH',allAboardDayNumber:null,allAboardTime:null,isEmbarkation:false,isDisembarkation:false})
    if(allAboardOnly&&initial.allAboardDayNumber==null&&initial.arrivalDayNumber===initial.departureDayNumber){
      initial.allAboardDayNumber=initial.arrivalDayNumber
    }
    return initial
  })
  const ports=useSources('ports',{tripId},Boolean(tripId),tripRevision),[draft,setDraft]=useState<Stop>(()=>structuredClone(initialSnapshot))
  const stopDirty=JSON.stringify(draft)!==JSON.stringify(initialSnapshot)
  const [attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({})
  const change=<K extends keyof Stop>(field:K,value:Stop[K])=>setDraft(old=>({...old,[field]:value}))
  const errors:Record<string,string>={}
  const port=ports.data.find(p=>p.id===draft.portId),zone=port?.timeZoneId??draft.timeZoneId
  const linked=content.entries.filter(e=>e.kind==='SHORE_EXCURSION'&&e.stopClientKey===draft.clientKey)
  const eligiblePorts=ports.data.filter(item=>portMatchesScope(item,tripInfo))
  const conflicts=overlappingStops({...draft,timeZoneId:zone},content.stops)
  const projected=projectRoute({days:content.days,stops:[...content.stops.filter(item=>item.clientKey!==draft.clientKey),{...draft,timeZoneId:zone}]})
  const samePortIssue=consecutiveSamePortViolations(projected).find(issue=>issue.clientKey===draft.clientKey)
  if(!port&&!ports.loading&&!ports.error)errors.portId=draft.portId?'Cảng đã chọn không còn trong danh mục hiện tại. Hãy chọn lại.':'Chọn cảng phù hợp với chuyến đi.'
  else if(port&&!portMatchesScope(port,tripInfo))errors.portId='Cảng không thuộc quốc gia hoặc miền đã chọn cho chuyến đi.'
  else if(samePortIssue)errors.portId=samePortIssue.message
  const routeIssue=routeOrderViolations({days:content.days,stops:projected.stops},tripInfo.earliestDeparture).find(issue=>issue.clientKey===draft.clientKey)
  const terminalIssue=callsAfterTerminal(projected.stops).find(issue=>issue.clientKey===draft.clientKey)
  const callTypeIssue=callTypeTimingViolations([{...draft,timeZoneId:zone}])[0]
  if(routeIssue)errors.plannedArrivalTime=routeIssue.message
  if(terminalIssue)errors[terminalIssue.field==='plannedArrivalTime'?'plannedArrivalTime':'plannedDepartureTime']=terminalIssue.message
  if(callTypeIssue&&callTypeIssue.field&&!errors[callTypeIssue.field])errors[callTypeIssue.field]=callTypeIssue.message
  const firstDay=content.days.find(d=>d.dayNumber===1)
  const effectiveDepTime=firstDay?.plannedDepartureTime||tripInfo.earliestDeparture||null
  const terminalStop=content.stops.find(s=>s.isDisembarkation&&s.clientKey!==draft.clientKey)
  const timingHints=[
    !draft.isEmbarkation&&effectiveDepTime?`Khởi hành Ngày 1: ${shortTime(effectiveDepTime)}`:null,
    !draft.isDisembarkation&&terminalStop?.plannedArrivalTime?`Cảng cuối ${terminalStop.portName||''} cập: Ngày ${terminalStop.arrivalDayNumber} ${shortTime(terminalStop.plannedArrivalTime)}`:null,
  ].filter(Boolean)
  const updateStopDays=(field:'arrivalDayNumber'|'departureDayNumber',nextDay:number)=>{
    setDraft(old=>{
      const updated={...old,[field]:nextDay}
      if(!updated.isDisembarkation&&updated.departureDayNumber>updated.arrivalDayNumber&&updated.callType==='NORMAL'){
        updated.callType='OVERNIGHT'
      }
      return updated
    })
  }
  if(conflicts.length)errors.plannedArrivalTime='Thời gian ghé chồng với '+conflicts.map(item=>'lần ghé '+item.stopOrder+' · '+(item.portName??'Cảng')).join(', ')+'. Điều chỉnh giờ dự kiến đến/rời.'
  if(port&&!validTimeZone(zone))errors.portId='Cảng chưa có múi giờ IANA hợp lệ.'
  if(!draft.plannedArrivalTime)errors.plannedArrivalTime='Nhập giờ đến.'
  if(!draft.plannedDepartureTime)errors.plannedDepartureTime='Nhập giờ rời.'
  if(draft.isDisembarkation&&draft.callType!=='NORMAL')errors.callType='Chọn kiểu ghé Thông thường cho cảng kết thúc.'
  if(draft.plannedArrivalTime&&draft.plannedDepartureTime&&timeNumber(draft.departureDayNumber,draft.plannedDepartureTime)<=timeNumber(draft.arrivalDayNumber,draft.plannedArrivalTime))errors.plannedDepartureTime='Ngày/giờ rời phải sau ngày/giờ đến.'
  if(content.days.some(day=>day.dayType==='SEA_DAY'&&day.dayNumber>=draft.arrivalDayNumber&&day.dayNumber<=draft.departureDayNumber))errors.plannedArrivalTime='Khoảng ghé cảng đi qua ngày trên biển. Hãy chọn ngày xuống bờ trước khi thêm cảng.'
  if(draft.isEmbarkation&&draft.arrivalDayNumber!==1)errors.embarkation='Cảng hành khách lên tàu phải ở Ngày 1. Hãy sửa ngày hoặc bỏ lựa chọn này.'
  if(draft.isDisembarkation&&draft.departureDayNumber!==content.days.length)errors.disembarkation='Cảng hành khách kết thúc chuyến phải ở ngày cuối. Hãy sửa ngày hoặc bỏ lựa chọn này.'
  if(Boolean(draft.allAboardDayNumber)!==Boolean(draft.allAboardTime))errors.allAboardTime='Nhập cả ngày và giờ hạn trở lại tàu.'
  if(linked.length&&(!draft.allAboardDayNumber||!draft.allAboardTime))errors.allAboardTime='Lần ghé có tour tham quan trên bờ cần hạn trở lại tàu.'
  if(draft.allAboardDayNumber&&draft.allAboardTime&&(timeNumber(draft.allAboardDayNumber,draft.allAboardTime)>timeNumber(draft.departureDayNumber,draft.plannedDepartureTime)||timeNumber(draft.allAboardDayNumber,draft.allAboardTime)<=timeNumber(draft.arrivalDayNumber,draft.plannedArrivalTime)))errors.allAboardTime='Hạn trở lại phải nằm trong khoảng ghé cảng.'
  if(stop&&linked.length&&draft.portId!==stop.portId)errors.portId='Xử lý các tham quan đang liên kết trước khi đổi cảng.'
  const affectedTours=linkedTourViolations(draft,content)
  if(affectedTours.length){
    const field=affectedTours.some(issue=>issue.field==='plannedStartTime')?'plannedArrivalTime'
      :timeNumber(draft.departureDayNumber,draft.plannedDepartureTime)<timeNumber(draft.allAboardDayNumber??draft.departureDayNumber,draft.allAboardTime??draft.plannedDepartureTime)?'plannedDepartureTime':'allAboardTime'
    errors[field]='Tour bờ đang gắn với lần ghé nằm ngoài khung giờ mới. Chỉnh giờ tour trước.'
  }
  const plannedDestinationIds=new Set<string>([...(draft.visits??[]).map(v=>v.destinationId),...(draft.destinationId?[draft.destinationId]:[])])
  const strandedTours=linked.filter(entry=>entry.destinationId&&!plannedDestinationIds.has(entry.destinationId))
  if(strandedTours.length){
    errors.visits=`Tour bờ “${strandedTours.map(entry=>entry.title).join(', ')}” đang dùng điểm tham quan vừa bỏ. Hãy giữ lại điểm tham quan đó hoặc chỉnh tour bờ trước.`
  }
  const hasTimingConflict=conflicts.length>0||Boolean(routeIssue)||Boolean(terminalIssue)||Boolean(callTypeIssue)
  const immediateStopError=(field:string)=>
    (field==='plannedArrivalTime'&&(conflicts.length>0||Boolean(routeIssue)||Boolean(callTypeIssue?.field==='plannedArrivalTime')||Boolean(draft.plannedArrivalTime&&errors.plannedArrivalTime)))
    ||(field==='plannedDepartureTime'&&(Boolean(terminalIssue)||Boolean(callTypeIssue?.field==='plannedDepartureTime')||Boolean(draft.plannedDepartureTime&&errors.plannedDepartureTime)))
    ||(field==='callType'&&Boolean(callTypeIssue?.field==='callType'))
    ||(field==='allAboardTime'&&Boolean((draft.allAboardTime||affectedTours.length)&&errors.allAboardTime))
    ||(field==='portId'&&Boolean(samePortIssue))
  const shown=(field:string)=>server.errorFor(field)??(attempted||touched[field]||immediateStopError(field)?errors[field]:undefined)
  const touch=(field:string)=>()=>setTouched(old=>({...old,[field]:true}))
  const days=(value:number,onChange:(n:number)=>void,id:string)=> <select id={id} value={value} disabled={readOnly} onChange={e=>onChange(Number(e.target.value))}>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select>
  const focusedAllAboard=allAboardOnly&&!shown('portId')&&!shown('callType')&&!shown('plannedArrivalTime')&&!shown('plannedDepartureTime')&&!hasTimingConflict
  const aboardDayChoices=content.days.filter(d=>d.dayNumber>=draft.arrivalDayNumber&&d.dayNumber<=draft.departureDayNumber)
  const sameCallDay=draft.arrivalDayNumber===draft.departureDayNumber
  const aboardMin=sameCallDay&&draft.plannedArrivalTime?draft.plannedArrivalTime.slice(0,5):undefined
  const aboardMax=sameCallDay&&draft.plannedDepartureTime?draft.plannedDepartureTime.slice(0,5):undefined
  const portTitle=port?.name??port?.label??draft.portName??'Chưa chọn cảng'
  const visitPort=port
    ? { name: port.name ?? port.label, countryCode: port.countryCode, destinationId: port.destinationId, servedDestinationIds: port.servedDestinationIds }
    : draft.portId
      ? { name: draft.portName ?? 'Cảng đã chọn', countryCode: draft.countryCode, destinationId: draft.destinationId ?? undefined }
      : undefined
  const portMeta=[
    (port?.countryCode??draft.countryCode)?countryLabel(port?.countryCode??draft.countryCode):null,
    (port?.countryCode??draft.countryCode)==='VN'&&(port?.domesticRegion??draft.domesticRegion)?domesticRegionLabel(port?.domesticRegion??draft.domesticRegion):null,
    zone?`Giờ địa phương: ${zone}`:'Chưa xác định múi giờ',
  ].filter(Boolean).join(' · ')
  function apply(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();setAttempted(true);if(readOnly)return
    const normalized=focusedAllAboard&&!draft.allAboardTime?{...draft,allAboardDayNumber:null}:draft
    if(Boolean(normalized.allAboardDayNumber)!==Boolean(normalized.allAboardTime)){focusError('stop-draft');return}
    if(Object.keys(errors).filter(k=>!focusedAllAboard||k!=='allAboardTime'||Boolean(normalized.allAboardTime)||linked.length>0).length||ports.loading||ports.error){focusError('stop-draft');return}
    onApply({...normalized,portName:port?.name??port?.label??normalized.portName,timeZoneId:zone,countryCode:port?.countryCode??normalized.countryCode,domesticRegion:port?.domesticRegion??normalized.domesticRegion??null});onClose()
  }
  const drawerTitle=focusedAllAboard?'Chi tiết lần ghé & hạn trở lại tàu':!draft.isEmbarkation&&!draft.isDisembarkation?(stop?'Sửa lần ghé':'Thêm lần ghé'):(stop?'Sửa ':'Chọn ')+stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation).toLocaleLowerCase('vi')
  return <Modal variant="drawer" wide title={drawerTitle} onClose={onClose} protectChanges={!readOnly} dirty={stopDirty} footer={<><Button tone="secondary" data-overlay-dismiss onClick={onClose}>{readOnly?'Đóng':'Hủy'}</Button>{!readOnly&&<Button type="submit" form="stop-draft" disabled={ports.loading||Boolean(ports.error)||!eligiblePorts.length}>{stop?'Lưu thay đổi':'Thêm lần ghé'}</Button>}</>}>
    {hasTimingConflict&&<Notice title="Thời gian ghé cảng bị xung đột" tone="error">{errors.plannedArrivalTime??errors.plannedDepartureTime}</Notice>}
    <form tabIndex={-1} onChangeCapture={server.dismiss} id="stop-draft" className={`${styles.single} ${styles.stopForm}`} onSubmit={e=>apply(e)} noValidate>
      {server.notice}
      {focusedAllAboard ? (
        <dl className={styles.portContext}>
          <div>
            <dt>{stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation)}</dt>
            <dd><strong>{portTitle}</strong><br/><span className={styles.muted}>{portMeta}</span></dd>
          </div>
          <div>
            <dt>{draft.isDisembarkation?'Giờ cập cảng & kết thúc (chỉ xem)':'Thời gian tàu đến và rời cảng (chỉ xem)'}</dt>
            <dd>{sameCallDay?`Ngày ${draft.arrivalDayNumber} · ${shortTime(draft.plannedArrivalTime)} – ${shortTime(draft.plannedDepartureTime)}`:`Ngày ${draft.arrivalDayNumber} ${shortTime(draft.plannedArrivalTime)} → Ngày ${draft.departureDayNumber} ${shortTime(draft.plannedDepartureTime)}`}</dd>
          </div>
        </dl>
      ) : (
        <>
          <SourcePicker portLayout id="stop-port" label={stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation)+' *'} placeholder={'Chọn '+stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation).toLocaleLowerCase('vi')} emptyMessage="Không có cảng phù hợp với phạm vi, quốc gia và miền đã chọn. Kiểm tra thông tin chuyến hoặc danh mục cảng." value={draft.portId} selectedLabel={draft.portName} options={eligiblePorts} loading={ports.loading} loadError={ports.error} error={shown('portId')} readOnly={readOnly} retry={ports.retry} onBlur={touch('portId')} onChange={id=>{const selected=ports.data.find(p=>p.id===id);setDraft(old=>({...old,portId:id,portName:selected?.name??selected?.label,timeZoneId:selected?.timeZoneId,countryCode:selected?.countryCode,domesticRegion:selected?.domesticRegion??null}))}}/>
          {port&&<p className={styles.portSelectionMeta}>{portMeta}</p>}
        </>
      )}
      {(!readOnly||!draft.isDisembarkation||linked.length>0||draft.allAboardTime||shown('allAboardTime'))&&focusedAllAboard&&(
        <fieldset className={styles.formGroup}><legend>Hạn hành khách trở lại tàu</legend><div className={styles.grid}><Field htmlFor="stop-aboard-day" label="Ngày hạn trở lại tàu"><select id="stop-aboard-day" value={draft.allAboardDayNumber??''} disabled={readOnly||aboardDayChoices.length===1} onChange={e=>change('allAboardDayNumber',e.target.value?Number(e.target.value):null)}><option value="">Chưa chọn</option>{(aboardDayChoices.length?aboardDayChoices:content.days).map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select></Field><Field htmlFor="stop-aboard" label="Giờ hạn trở lại tàu" error={shown('allAboardTime')}><input id="stop-aboard" type="time" min={aboardMin} max={aboardMax} step={timeStep(draft.allAboardTime)} value={draft.allAboardTime??''} disabled={readOnly} aria-invalid={Boolean(shown('allAboardTime'))} onBlur={touch('allAboardTime')} onChange={e=>{const nextTime=e.target.value||null;setDraft(old=>({...old,allAboardTime:nextTime,allAboardDayNumber:nextTime?(old.allAboardDayNumber??(old.arrivalDayNumber===old.departureDayNumber?old.arrivalDayNumber:null)):null}))}}/></Field></div>
        </fieldset>
      )}
      <fieldset className={styles.formGroup}>
        <legend>Kiểu ghé</legend>
        <div className={styles.single}>
          <div>
            <Field htmlFor="stop-call" label="Kiểu ghé cảng" error={shown('callType')}>
              <select id="stop-call" aria-describedby={draft.isDisembarkation?undefined:"stop-call-help"} aria-invalid={Boolean(shown('callType'))} value={draft.callType} disabled={readOnly} onChange={e=>change('callType',e.target.value as Stop['callType'])}>
                <option value="NORMAL">Thông thường</option>
                {(!draft.isDisembarkation||draft.callType==='LATE_NIGHT')&&<option disabled={draft.isDisembarkation} value="LATE_NIGHT">Ban đêm</option>}
                {(!draft.isDisembarkation||draft.callType==='OVERNIGHT')&&<option disabled={draft.isDisembarkation} value="OVERNIGHT">Qua đêm</option>}
              </select>
            </Field>
            {!draft.isDisembarkation&&(
              <ul id="stop-call-help" className={styles.callTypeGuide}>
                <li data-active={draft.callType==='NORMAL'}>
                  <strong>Thông thường:</strong> Đến và rời trong <em>cùng ngày</em>, khung <strong>05:00 – 21:00</strong> (VD: Ngày 1 08:00 → Ngày 1 18:00).
                </li>
                <li data-active={draft.callType==='LATE_NIGHT'}>
                  <strong>Ban đêm:</strong> Rời muộn <strong>21:00 – 23:59</strong> cùng ngày, hoặc cập từ <strong>18:00</strong> và rời rạng sáng <strong>00:00 – 03:00</strong> hôm sau (VD: Ngày 1 20:30 → Ngày 1 23:30).
                </li>
                <li data-active={draft.callType==='OVERNIGHT'}>
                  <strong>Qua đêm:</strong> Neo tàu sang <em>ngày hôm sau</em> (Ngày rời &gt; Ngày đến) và rời sau <strong>03:00</strong> sáng (VD: Ngày 1 22:00 → Ngày 2 09:00).
                </li>
              </ul>
            )}
          </div>
        </div>
      </fieldset>
      {!focusedAllAboard && (
        <fieldset className={styles.formGroup}><legend>Thời gian tàu đến và rời cảng</legend>{timingHints.length>0&&<p className={styles.timeContext}>Mốc tham chiếu: {timingHints.join(' · ')}</p>}<div className={styles.grid}><Field htmlFor="stop-arrival-day" label="Ngày tàu đến *">{days(draft.arrivalDayNumber,n=>updateStopDays('arrivalDayNumber',n),'stop-arrival-day')}</Field><Field htmlFor="stop-arrival" label="Giờ tàu dự kiến đến *" error={shown('plannedArrivalTime')}><input id="stop-arrival" type="time" step={timeStep(draft.plannedArrivalTime)} value={draft.plannedArrivalTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedArrivalTime'))} onBlur={touch('plannedArrivalTime')} onChange={e=>change('plannedArrivalTime',e.target.value)}/></Field><Field htmlFor="stop-departure-day" label={draft.isDisembarkation?"Ngày kết thúc dự kiến *":"Ngày tàu rời *"}>{days(draft.departureDayNumber,n=>updateStopDays('departureDayNumber',n),'stop-departure-day')}</Field><Field htmlFor="stop-departure" label={draft.isDisembarkation?"Giờ kết thúc dự kiến *":"Giờ tàu dự kiến rời *"} error={shown('plannedDepartureTime')}><input id="stop-departure" type="time" step={timeStep(draft.plannedDepartureTime)} value={draft.plannedDepartureTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedDepartureTime'))} onBlur={touch('plannedDepartureTime')} onChange={e=>change('plannedDepartureTime',e.target.value)}/></Field></div>
        </fieldset>
      )}
      <fieldset className={styles.formGroup}>
        <legend>{draft.isDisembarkation?'Cách cập bến và xuống tàu':'Cách cập bến và lên bờ'}</legend>
        <Field htmlFor="stop-method" label={draft.isDisembarkation?'Cách khách xuống tàu':'Cách lên bờ'}>
          <select id="stop-method" value={draft.arrivalMethod} disabled={readOnly} onChange={e=>change('arrivalMethod',e.target.value as Stop['arrivalMethod'])}>
            <option value="BERTH">Cập bến</option>
            <option value="TENDER">Trung chuyển bằng tàu nhỏ</option>
          </select>
        </Field>
      </fieldset>
      {(!readOnly||!draft.isDisembarkation||linked.length>0||draft.allAboardTime||shown('allAboardTime'))&&!focusedAllAboard&&(
        <fieldset className={styles.formGroup}><legend>Hạn hành khách trở lại tàu</legend>{draft.plannedArrivalTime&&draft.plannedDepartureTime&&<p className={styles.timeContext}>Phải nằm trong khoảng ghé cảng: Ngày {draft.arrivalDayNumber} {shortTime(draft.plannedArrivalTime)} – Ngày {draft.departureDayNumber} {shortTime(draft.plannedDepartureTime)}.</p>}<div className={styles.grid}><Field htmlFor="stop-aboard-day" label="Ngày hạn trở lại tàu"><select id="stop-aboard-day" value={draft.allAboardDayNumber??''} disabled={readOnly} onChange={e=>change('allAboardDayNumber',e.target.value?Number(e.target.value):null)}><option value="">Chưa chọn</option>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select></Field><Field htmlFor="stop-aboard" label="Giờ hạn trở lại tàu" error={shown('allAboardTime')}><input id="stop-aboard" type="time" min={aboardMin} max={aboardMax} step={timeStep(draft.allAboardTime)} value={draft.allAboardTime??''} disabled={readOnly} aria-invalid={Boolean(shown('allAboardTime'))} onBlur={touch('allAboardTime')} onChange={e=>{const nextTime=e.target.value||null;setDraft(old=>({...old,allAboardTime:nextTime,allAboardDayNumber:nextTime?(old.allAboardDayNumber??(old.arrivalDayNumber===old.departureDayNumber?old.arrivalDayNumber:null)):old.allAboardDayNumber}))}}/></Field></div>
        </fieldset>
      )}
      {(visitPort||Boolean(draft.visits?.length))&&<DestinationVisits readOnly={readOnly} port={visitPort} visits={draft.visits??[]} onChange={visits=>change('visits',visits)}/>}
      {errors.visits&&<p className={styles.error} role="alert">{errors.visits}</p>}
      {(errors.embarkation||errors.disembarkation)&&<p className={styles.error} role="alert">{errors.embarkation??errors.disembarkation}</p>}
      {linked.length>0&&<p>Tour đang liên kết: {linked.map(e=>e.title).join(', ')}. Tour giữ liên kết với lần ghé này.</p>}
    </form>
  </Modal>
}

export function EntryDrawer(props:EntryDrawerProps) {
  return props.readOnly||props.kind==='SERVING_WINDOW'?<EntryDetails content={props.content} entry={props.entry} kind={props.kind} onClose={props.onClose} violation={props.violation}/>:<EntryForm {...props}/>
}

function EntryForm({content,dayNumber,readOnly,entry,kind,initialStopClientKey,onClose,onApply,violation}:EntryDrawerProps) {
  const onboard=kind==='ONBOARD_ACTIVITY'
  const server=useViolationField(violation,'entry-draft',readOnly,onboard)
  const [keyword,setKeyword]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[retained,setRetained]=useState<Source>()
  const categories=useSources('activityCategories',{},kind==='ONBOARD_ACTIVITY')
  const initialStop=kind==='SHORE_EXCURSION'?content.stops.find(s=>s.clientKey===initialStopClientKey):undefined
  const [initialEntrySnapshot]=useState<Entry>(()=>structuredClone(entry??{clientKey:newKey(),dayNumber,kind,sourceId:null,serviceId:null,stopClientKey:initialStop?.clientKey??null,title:'',startDayNumber:initialStop?.arrivalDayNumber??dayNumber,plannedStartTime:'',endDayNumber:initialStop?.allAboardDayNumber??initialStop?.departureDayNumber??dayNumber,plannedEndTime:'',timeZoneId:kind==='SHORE_EXCURSION'?'':SHIP_ZONE,locationText:'',meetingPoint:'',notes:''}))
  const [draft,setDraft]=useState<Entry>(()=>structuredClone(initialEntrySnapshot)),[attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({})
  const entryDirty=JSON.stringify(draft)!==JSON.stringify(initialEntrySnapshot)
  const change=<K extends keyof Entry>(field:K,value:Entry[K])=>setDraft(old=>({...old,[field]:value}))
  const stop=content.stops.find(s=>s.clientKey===draft.stopClientKey),zone=kind==='SHORE_EXCURSION'?stop?.timeZoneId:SHIP_ZONE,errors:Record<string,string>={}
  const plannedDestinations=(()=>{
    if(kind!=='SHORE_EXCURSION'||!stop)return [] as {destinationId:string;destinationName:string}[]
    const seen=new Set<string>()
    const list:{destinationId:string;destinationName:string}[]=[]
    for(const visit of stop.visits??[]){
      if(visit.destinationId&&!seen.has(visit.destinationId)){
        seen.add(visit.destinationId)
        list.push({destinationId:visit.destinationId,destinationName:visit.destinationName?.trim()||'Điểm đến đã lên kế hoạch'})
      }
    }
    if(stop.destinationId&&!seen.has(stop.destinationId)){
      seen.add(stop.destinationId)
      list.push({destinationId:stop.destinationId,destinationName:stop.destinationName?.trim()||'Điểm đến của cảng'})
    }
    return list
  })()
  const [selectedDestinationId,setSelectedDestinationId]=useState<string>(()=>entry?.destinationId??'')
  const activeDestinationId=kind!=='SHORE_EXCURSION'
    ? ''
    : plannedDestinations.length===1
      ? plannedDestinations[0].destinationId
      : plannedDestinations.some(item=>item.destinationId===selectedDestinationId)
        ? selectedDestinationId
        : plannedDestinations[0]?.destinationId??''
  const activeDestination=plannedDestinations.find(item=>item.destinationId===activeDestinationId)
  const sources=useSources(
    kind==='ONBOARD_ACTIVITY'?'activities':'excursions',
    {keyword,category:categoryFilter,portId:kind==='SHORE_EXCURSION'?stop?.portId:undefined,destinationId:kind==='SHORE_EXCURSION'?activeDestinationId||undefined:undefined},
    kind!=='SHORE_EXCURSION'||Boolean(stop&&activeDestinationId),
  )
  const filtering=Boolean(keyword.trim()||categoryFilter)
  const chosen=sources.data.find(source=>source.id===draft.sourceId)??(filtering&&retained?.id===draft.sourceId?retained:undefined)
  function search(value:string){if(chosen)setRetained(chosen);setKeyword(value)}
  function filterCategory(value:string){if(chosen)setRetained(chosen);setCategoryFilter(value)}
  function changeDestination(nextDestinationId:string){
    setSelectedDestinationId(nextDestinationId)
    setKeyword('')
    setRetained(undefined)
    const target=plannedDestinations.find(item=>item.destinationId===nextDestinationId)
    setDraft(old=>({
      ...old,
      destinationId:nextDestinationId||null,
      destinationName:target?.destinationName??null,
      ...(old.destinationId&&old.destinationId!==nextDestinationId?{sourceId:null,sourceExcursionId:null}:{}),
    }))
  }

  const limitByAllAboard=Boolean(stop?.allAboardDayNumber!=null&&stop?.allAboardTime&&(!stop.plannedDepartureTime||timeNumber(stop.allAboardDayNumber,stop.allAboardTime)<=timeNumber(stop.departureDayNumber,stop.plannedDepartureTime)))
  const stopLimitDay=stop?(limitByAllAboard?stop.allAboardDayNumber!:stop.departureDayNumber):content.days.length
  const stopLimitTime=stop?(limitByAllAboard?stop.allAboardTime!:stop.plannedDepartureTime):null
  const stopStartBound=stop?.plannedArrivalTime?timeNumber(stop.arrivalDayNumber,stop.plannedArrivalTime):null
  const stopEndBound=stop&&stopLimitTime?timeNumber(stopLimitDay,stopLimitTime):null

  if(!draft.sourceId||!chosen)errors.sourceId='Chọn nguồn hợp lệ từ danh mục.'
  if(onboard&&(draft.locationText?.length??0)>255)errors.locationText='Địa điểm tối đa 255 ký tự.'
  if(!draft.title.trim())errors.title='Nhập tiêu đề.'
  if(draft.title.length>200)errors.title='Tiêu đề tối đa 200 ký tự.'
  if(!draft.plannedStartTime)errors.plannedStartTime='Nhập giờ bắt đầu.'
  if(!draft.plannedEndTime)errors.plannedEndTime='Nhập giờ kết thúc.'
  else if(draft.plannedStartTime&&timeNumber(draft.endDayNumber,draft.plannedEndTime)<=timeNumber(draft.startDayNumber,draft.plannedStartTime))errors.plannedEndTime='Kết thúc phải sau bắt đầu.'
  if(draft.startDayNumber<1||draft.endDayNumber>content.days.length)errors.plannedEndTime='Thời gian phải nằm trong các ngày của lịch trình.'
  if(kind==='SHORE_EXCURSION') {
    if(chosen?.portId&&stop&&chosen.portId!==stop.portId)errors.sourceId='Nguồn tham quan không thuộc cảng của lần ghé đã chọn.'
    if(!stop)errors.stop='Chọn lần ghé cảng.'
    else if(plannedDestinations.length===0)errors.stop='Lần ghé này chưa có Điểm tham quan. Hãy bổ sung Điểm tham quan trong lần ghé cảng trước khi thêm tour bờ.'
    if(plannedDestinations.length>0&&!activeDestinationId)errors.destinationId='Chọn điểm tham quan đã lên kế hoạch cho lần ghé này.'
    if(chosen?.destinationId&&plannedDestinations.length>0&&!plannedDestinations.some(item=>item.destinationId===chosen.destinationId)){
      errors.sourceId='Điểm đến của tour bờ chưa được thêm vào Điểm tham quan của lần ghé cảng này.'
    } else if(chosen?.destinationId&&activeDestinationId&&chosen.destinationId!==activeDestinationId){
      errors.sourceId='Nguồn tour bờ không thuộc điểm đến đang chọn.'
    }

    if(!validTimeZone(zone))errors.stop='Lần ghé cảng chưa có múi giờ hợp lệ.'
    if(stop&&(!stop.allAboardDayNumber||!stop.allAboardTime))errors.stop='Cần bổ sung hạn trở lại tàu trong lần ghé trước khi thêm tham quan.'
    if(stop&&draft.plannedStartTime&&stopStartBound!=null&&timeNumber(draft.startDayNumber,draft.plannedStartTime)<stopStartBound){
      errors.plannedStartTime=`Tour bờ phải bắt đầu từ lúc tàu đến cảng (${shortTime(stop.plannedArrivalTime)}) trở đi.`
    } else if(stop&&draft.plannedStartTime&&stopEndBound!=null&&timeNumber(draft.startDayNumber,draft.plannedStartTime)>=stopEndBound){
      errors.plannedStartTime=`Giờ bắt đầu tour bờ phải trước hạn trở lại tàu / giờ kết thúc (${shortTime(stopLimitTime)}).`
    }
    if(stop&&draft.plannedEndTime&&stopEndBound!=null&&timeNumber(draft.endDayNumber,draft.plannedEndTime)>stopEndBound){
      errors.plannedEndTime=`Tour bờ phải kết thúc không muộn hơn hạn trở lại tàu / giờ kết thúc (${shortTime(stopLimitTime)}).`
    }
  }
  const immediateEntryError=(field:string)=>
    (field==='plannedStartTime'&&Boolean(draft.plannedStartTime&&errors.plannedStartTime))
    ||(field==='plannedEndTime'&&Boolean(draft.plannedEndTime&&errors.plannedEndTime))
    ||(field==='sourceId'&&Boolean(chosen&&errors.sourceId))
  const shown=(field:string)=>server.errorFor(field)??(attempted||touched[field]||immediateEntryError(field)?errors[field]:undefined)
  const touch=(field:string)=>()=>setTouched(old=>({...old,[field]:true}))
  const allowedDays=kind==='SHORE_EXCURSION'&&stop?content.days.filter(d=>d.dayNumber>=stop.arrivalDayNumber&&d.dayNumber<=stopLimitDay):content.days
  const dayChoices=allowedDays.length?allowedDays:content.days
  const singleStopDay=kind==='SHORE_EXCURSION'&&dayChoices.length===1
  const sameDayMin=singleStopDay&&stop?.plannedArrivalTime?stop.plannedArrivalTime.slice(0,5):undefined
  const sameDayMax=singleStopDay&&stopLimitTime?stopLimitTime.slice(0,5):undefined
  const daySelect=(value:number,onChange:(n:number)=>void,id:string)=><select id={id} value={value} disabled={readOnly||singleStopDay} onChange={e=>onChange(Number(e.target.value))}>{dayChoices.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select>
  function apply(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();setAttempted(true);if(readOnly)return
    if(Object.keys(errors).length||sources.loading||sources.error){focusError('entry-draft');return}
    const saved:Entry={
      ...draft,
      dayNumber:draft.startDayNumber,
      timeZoneId:zone!,
      serviceId:null,
      ...(kind==='SHORE_EXCURSION'?{
        destinationId:chosen?.destinationId??activeDestinationId??draft.destinationId??null,
        destinationName:chosen?.destinationName??activeDestination?.destinationName??draft.destinationName??null,
      }:{}),
    }
    onApply([saved]);onClose()
  }
  const excursionDestinationLabel=chosen?.destinationName??activeDestination?.destinationName??draft.destinationName
  return <Modal variant="drawer" wide title={`${readOnly?'Xem':entry?'Chỉnh':'Thêm'} ${kindLabels[kind].toLocaleLowerCase('vi')}`} onClose={onClose} protectChanges={!readOnly} dirty={entryDirty} footer={<><Button tone="secondary" data-overlay-dismiss onClick={onClose}>{readOnly?'Đóng':'Hủy'}</Button>{!readOnly&&<Button type="submit" form="entry-draft" disabled={sources.loading||Boolean(sources.error)||!chosen||(kind==='SHORE_EXCURSION'&&plannedDestinations.length===0)}>{entry?'Cập nhật mục':'Thêm vào lịch trình'}</Button>}</>}>
    <form tabIndex={-1} onChangeCapture={server.dismiss} id="entry-draft" className={styles.single} onSubmit={e=>apply(e)} noValidate>
      {server.notice}
      {kind==='SHORE_EXCURSION'&&<Field htmlFor="entry-stop" label="Cảng tổ chức" error={shown('stop')}><input id="entry-stop" value={stop?.portName??'Không tìm thấy cảng'} readOnly aria-invalid={Boolean(shown('stop'))}/></Field>}
      {kind==='SHORE_EXCURSION'&&stop&&plannedDestinations.length===0&&(
        <Notice title="Chưa có điểm tham quan cho lần ghé" tone="warning">
          Lần ghé cảng này chưa có điểm đến nào trong mục Điểm tham quan. Hãy đóng hộp thoại này, mở thông tin lần ghé cảng để thêm điểm tham quan rồi mới chọn tour bờ.
        </Notice>
      )}
      {kind==='SHORE_EXCURSION'&&plannedDestinations.length===1&&(
        <Field htmlFor="entry-destination" label="Điểm tham quan của lần ghé" error={shown('destinationId')}>
          <input id="entry-destination" value={plannedDestinations[0].destinationName} readOnly aria-invalid={Boolean(shown('destinationId'))}/>
        </Field>
      )}
      {kind==='SHORE_EXCURSION'&&plannedDestinations.length>1&&(
        <Field htmlFor="entry-destination" label="Điểm tham quan *" error={shown('destinationId')}>
          <select id="entry-destination" value={activeDestinationId} disabled={readOnly} aria-invalid={Boolean(shown('destinationId'))} onBlur={touch('destinationId')} onChange={e=>changeDestination(e.target.value)}>
            {plannedDestinations.map(item=><option key={item.destinationId} value={item.destinationId}>{item.destinationName}</option>)}
          </select>
        </Field>
      )}
      {kind==='ONBOARD_ACTIVITY'&&!readOnly&&<Field htmlFor="entry-category-filter" label="Nhóm hoạt động" error={categories.error||undefined}><select id="entry-category-filter" value={categoryFilter} disabled={categories.loading||Boolean(categories.error)||sources.loading} onChange={e=>filterCategory(e.target.value)}><option value="">Tất cả nhóm</option>{categories.data.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>{categories.error&&<Button type="button" tone="text" onClick={categories.retry}>Tải lại nhóm</Button>}</Field>}
      {(kind!=='SHORE_EXCURSION'||(stop&&plannedDestinations.length>0))&&<SourcePicker id="entry-source" label={kind==='ONBOARD_ACTIVITY'?'Hoạt động *':'Tour tham quan trên bờ *'} placeholder={kind==='ONBOARD_ACTIVITY'?'Chọn hoạt động':'Chọn tour bờ theo điểm tham quan đã chọn'} emptyMessage={kind==='SHORE_EXCURSION'?'Điểm tham quan này chưa có tour bờ nào được cảng phục vụ trong danh mục.':'Danh mục chưa có nguồn phù hợp.'} value={draft.sourceId??''} selectedLabel={draft.title} selectedSource={chosen} options={sources.data} loading={sources.loading} loadError={sources.error} error={shown('sourceId')} readOnly={readOnly} retry={()=>{setRetained(undefined);sources.retry()}} onBlur={touch('sourceId')} searchValue={keyword} onSearch={search} filtered={Boolean(categoryFilter)} onChange={id=>{const source=sources.data.find(item=>item.id===id);if(source){setDraft(old=>selectEntrySource(old,source,chosen));setRetained(source)}else{change('sourceId',null);setRetained(undefined)}}}/>}
      {(draft.categoryName||draft.displayLocation||draft.referenceShipName||(kind==='SHORE_EXCURSION'&&excursionDestinationLabel))&&<div className={styles.sourceContext}>{kind==='SHORE_EXCURSION'&&excursionDestinationLabel&&<span>Điểm tham quan: {excursionDestinationLabel}</span>}{kind==='SHORE_EXCURSION'&&chosen?.supplierName&&<span>Đơn vị cung cấp: {chosen.supplierName}</span>}{draft.categoryName&&<span>{draft.categoryName}</span>}{draft.referenceShipName&&<span>Tàu tham chiếu: {draft.referenceShipName}</span>}{draft.displayLocation&&<span>Vị trí tham chiếu: {draft.displayLocation}</span>}</div>}
      <Field htmlFor="entry-title" label="Tiêu đề *" error={shown('title')}><input id="entry-title" maxLength={200} value={draft.title??''} disabled={readOnly} aria-invalid={Boolean(shown('title'))} onBlur={touch('title')} onChange={e=>change('title',e.target.value)}/></Field>
      {kind==='SHORE_EXCURSION'&&stop?.plannedArrivalTime&&stopLimitTime?<p className={styles.timeContext}>Khung giờ cho phép tại cảng: {stop.arrivalDayNumber===stopLimitDay?`Ngày ${stop.arrivalDayNumber} · ${shortTime(stop.plannedArrivalTime)} – ${shortTime(stopLimitTime)}`:`Ngày ${stop.arrivalDayNumber} ${shortTime(stop.plannedArrivalTime)} → Ngày ${stopLimitDay} ${shortTime(stopLimitTime)}`}</p>:kind!=='SHORE_EXCURSION'&&<p className={styles.timeContext}>Giờ Việt Nam</p>}
      <div className={styles.grid}><Field htmlFor="entry-start-day" label="Ngày bắt đầu">{daySelect(draft.startDayNumber,n=>change('startDayNumber',n),'entry-start-day')}</Field><Field htmlFor="entry-start" label="Giờ bắt đầu *" error={shown('plannedStartTime')}><input id="entry-start" type="time" min={sameDayMin} max={sameDayMax} step={timeStep(draft.plannedStartTime)} value={draft.plannedStartTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedStartTime'))} onBlur={touch('plannedStartTime')} onChange={e=>change('plannedStartTime',e.target.value)}/></Field><Field htmlFor="entry-end-day" label="Ngày kết thúc">{daySelect(draft.endDayNumber,n=>change('endDayNumber',n),'entry-end-day')}</Field><Field htmlFor="entry-end" label="Giờ kết thúc *" error={shown('plannedEndTime')}><input id="entry-end" type="time" min={draft.plannedStartTime&&singleStopDay?draft.plannedStartTime.slice(0,5):sameDayMin} max={sameDayMax} step={timeStep(draft.plannedEndTime)} value={draft.plannedEndTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedEndTime'))} onBlur={touch('plannedEndTime')} onChange={e=>change('plannedEndTime',e.target.value)}/></Field></div>
      {onboard&&<>
        <Field htmlFor="entry-location" label="Địa điểm tổ chức" error={shown('locationText')}><input id="entry-location" aria-invalid={Boolean(shown('locationText'))} aria-describedby="entry-meeting-help" onBlur={touch('locationText')} maxLength={255} value={draft.locationText??''} disabled={readOnly} onChange={e=>change('locationText',e.target.value)}/></Field>
        <Field htmlFor="entry-meeting" label="Điểm tập trung" error={shown('meetingPoint')}><input id="entry-meeting" maxLength={255} value={draft.meetingPoint??''} disabled={readOnly} aria-invalid={Boolean(shown('meetingPoint'))} aria-describedby="entry-meeting-help" onBlur={touch('meetingPoint')} onChange={e=>change('meetingPoint',e.target.value)}/><small id="entry-meeting-help">Trước khi chốt mẫu, điền địa điểm tổ chức hoặc điểm tập trung.</small></Field>
      </>}
      <Field htmlFor="entry-notes" label="Ghi chú"><textarea id="entry-notes" rows={3} value={draft.notes??''} disabled={readOnly} onChange={e=>change('notes',e.target.value)}/></Field>
    </form>
  </Modal>
}


