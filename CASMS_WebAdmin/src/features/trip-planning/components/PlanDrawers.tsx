import { projectRoute } from '../model/route-order'
import { useEffect, useState } from 'react'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { validTimeZone } from '@/shared/lib/journey-time'
import { useSources } from '../hooks'
import { countryLabel, domesticRegionLabel, kindLabels, newKey, SHIP_ZONE, timeNumber, type Content, type Entry, type Stop, type Source, type TripInfo, type Violation } from '../model/plan'
import styles from '../Planning.module.css'
import { DestinationVisits } from './DestinationVisits'
import { SourcePicker } from './SourcePicker'
import { scheduleDayLabel, stopRoleLabel } from '../model/day-labels'
import { selectEntrySource } from '../model/source-selection'
import { violationTarget, violationFieldId } from '../model/violation-target'
import { EntryDetails, StopDetails } from './PlanDetails'
import { callsAfterTerminal, consecutiveSamePortViolations, linkedTourViolations, overlappingStops, portMatchesScope, routeOrderViolations } from '../model/port-rules'

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
type StopDrawerProps={tripId:string;tripRevision:number;tripInfo:TripInfo;stop?:Stop;onApply:(stop:Stop)=>void}&DrawerProps
type EntryDrawerProps={entry?:Entry;initialStopClientKey?:string;kind:Entry['kind'];onApply:(entries:Entry[])=>void}&DrawerProps

export function StopDrawer(props:StopDrawerProps) {
  return props.readOnly?<StopDetails stop={props.stop} onClose={props.onClose} violation={props.violation}/>:<StopForm {...props}/>
}

function StopForm({content,tripId,tripRevision,tripInfo,dayNumber,readOnly,stop,onClose,onApply,violation}:StopDrawerProps) {
  const server=useViolationField(violation,'stop-draft',readOnly)
  const ports=useSources('ports',{tripId},Boolean(tripId),tripRevision),[draft,setDraft]=useState<Stop>(()=>structuredClone(stop??{clientKey:newKey(),portId:'',portName:'',stopOrder:Math.max(0,...content.stops.map(s=>s.stopOrder))+1,arrivalDayNumber:dayNumber,plannedArrivalTime:'',departureDayNumber:dayNumber,plannedDepartureTime:'',callType:'NORMAL',arrivalMethod:'BERTH',allAboardDayNumber:null,allAboardTime:null,isEmbarkation:false,isDisembarkation:false}))
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
  const routeIssue=routeOrderViolations({days:content.days,stops:projected.stops}).find(issue=>issue.clientKey===draft.clientKey)
  const terminalIssue=callsAfterTerminal(projected.stops).find(issue=>issue.clientKey===draft.clientKey)
  if(routeIssue)errors.plannedArrivalTime=routeIssue.message
  if(terminalIssue)errors.plannedDepartureTime=terminalIssue.message
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
  const hasTimingConflict=conflicts.length>0||Boolean(routeIssue)||Boolean(terminalIssue)
  const shown=(field:string)=>server.errorFor(field)??(attempted||touched[field]||(field==='plannedArrivalTime'&&(conflicts.length>0||Boolean(routeIssue)))||(field==='plannedDepartureTime'&&Boolean(terminalIssue))||(field==='portId'&&Boolean(samePortIssue))?errors[field]:undefined)
  const touch=(field:string)=>()=>setTouched(old=>({...old,[field]:true}))
  const days=(value:number,onChange:(n:number)=>void,id:string)=> <select id={id} value={value} disabled={readOnly} onChange={e=>onChange(Number(e.target.value))}>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select>
  function apply(event:React.SubmitEvent<HTMLFormElement>) {event.preventDefault();setAttempted(true);if(readOnly)return;if(Object.keys(errors).length||ports.loading||ports.error){focusError('stop-draft');return}onApply({...draft,portName:port!.name??port!.label,timeZoneId:zone,countryCode:port?.countryCode??draft.countryCode,domesticRegion:port?.domesticRegion??null});onClose()}
  return <Modal variant="drawer" wide title={!draft.isEmbarkation&&!draft.isDisembarkation?(stop?'Sửa lần ghé':'Thêm lần ghé'):(stop?'Sửa ':'Chọn ')+stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation).toLocaleLowerCase('vi')} onClose={onClose} protectChanges={!readOnly} footer={<><Button tone="secondary" data-overlay-dismiss onClick={onClose}>{readOnly?'Đóng':'Hủy'}</Button>{!readOnly&&<Button type="submit" form="stop-draft" disabled={ports.loading||Boolean(ports.error)||!eligiblePorts.length}>{stop?'Lưu thay đổi':'Thêm lần ghé'}</Button>}</>}>
    {hasTimingConflict&&<Notice title="Thời gian ghé cảng bị xung đột" tone="error">{errors.plannedArrivalTime??errors.plannedDepartureTime}</Notice>}
    <form tabIndex={-1} onChangeCapture={server.dismiss} id="stop-draft" className={`${styles.single} ${styles.stopForm}`} onSubmit={e=>apply(e)} noValidate>
      {server.notice}<SourcePicker portLayout id="stop-port" label={stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation)+' *'} placeholder={'Chọn '+stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation).toLocaleLowerCase('vi')} emptyMessage="Không có cảng phù hợp với phạm vi, quốc gia và miền đã chọn. Kiểm tra thông tin chuyến hoặc danh mục cảng." value={draft.portId} selectedLabel={draft.portName} options={eligiblePorts} loading={ports.loading} loadError={ports.error} error={shown('portId')} readOnly={readOnly} retry={ports.retry} onBlur={touch('portId')} onChange={id=>{const selected=ports.data.find(p=>p.id===id);setDraft(old=>({...old,portId:id,portName:selected?.name??selected?.label,timeZoneId:selected?.timeZoneId,countryCode:selected?.countryCode,domesticRegion:selected?.domesticRegion??null}))}}/>
      {port&&<p className={styles.portSelectionMeta}>{countryLabel(port.countryCode??draft.countryCode)}
        {(port.countryCode??draft.countryCode)==='VN'&&draft.domesticRegion&&<> · {domesticRegionLabel(draft.domesticRegion)}</>}
        {' · '}{zone?`Giờ địa phương: ${zone}`:'Chưa xác định múi giờ'}</p>}
      <fieldset className={styles.formGroup}>
        <legend>Kiểu ghé</legend>
        <div className={styles.single}>
          <div><Field htmlFor="stop-call" label="Kiểu ghé cảng" error={shown('callType')}><select id="stop-call" aria-describedby={draft.isDisembarkation?undefined:"stop-call-help"} aria-invalid={Boolean(shown('callType'))} value={draft.callType} disabled={readOnly} onChange={e=>change('callType',e.target.value as Stop['callType'])}><option value="NORMAL">Thông thường</option>{(!draft.isDisembarkation||draft.callType==='LATE_NIGHT')&&<option disabled={draft.isDisembarkation} value="LATE_NIGHT">Ban đêm</option>}{(!draft.isDisembarkation||draft.callType==='OVERNIGHT')&&<option disabled={draft.isDisembarkation} value="OVERNIGHT">Qua đêm</option>}</select>{!draft.isDisembarkation&&<small id="stop-call-help"><em>{{NORMAL:'Tàu đến và rời cảng trong ngày.',LATE_NIGHT:'Tàu đến vào ban đêm rồi rời cảng.',OVERNIGHT:'Tàu ở lại qua đêm và rời cảng hôm sau.'}[draft.callType]}</em></small>}</Field></div>
        </div>
      </fieldset>
      <fieldset className={styles.formGroup}><legend>Thời gian tàu đến và rời cảng</legend><div className={styles.grid}><Field htmlFor="stop-arrival-day" label="Ngày tàu đến *">{days(draft.arrivalDayNumber,n=>change('arrivalDayNumber',n),'stop-arrival-day')}</Field><Field htmlFor="stop-arrival" label="Giờ tàu dự kiến đến *" error={shown('plannedArrivalTime')}><input id="stop-arrival" type="time" step={timeStep(draft.plannedArrivalTime)} value={draft.plannedArrivalTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedArrivalTime'))} onBlur={touch('plannedArrivalTime')} onChange={e=>change('plannedArrivalTime',e.target.value)}/></Field><Field htmlFor="stop-departure-day" label={draft.isDisembarkation?"Ngày kết thúc dự kiến *":"Ngày tàu rời *"}>{days(draft.departureDayNumber,n=>change('departureDayNumber',n),'stop-departure-day')}</Field><Field htmlFor="stop-departure" label={draft.isDisembarkation?"Giờ kết thúc dự kiến *":"Giờ tàu dự kiến rời *"} error={shown('plannedDepartureTime')}><input id="stop-departure" type="time" step={timeStep(draft.plannedDepartureTime)} value={draft.plannedDepartureTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedDepartureTime'))} onBlur={touch('plannedDepartureTime')} onChange={e=>change('plannedDepartureTime',e.target.value)}/></Field></div>
      </fieldset>
      <details className={styles.visitOptions}>
        <summary>Cách lên bờ · {draft.arrivalMethod === 'TENDER' ? 'Trung chuyển bằng tàu nhỏ' : 'Cập bến'}</summary>
        <Field htmlFor="stop-method" label={draft.isDisembarkation?"Cách khách xuống tàu":"Cách lên bờ"}><select id="stop-method" value={draft.arrivalMethod} disabled={readOnly} onChange={e=>change('arrivalMethod',e.target.value as Stop['arrivalMethod'])}><option value="BERTH">Cập bến</option><option value="TENDER">Trung chuyển bằng tàu nhỏ</option></select></Field>
      </details>
      {(!readOnly||!draft.isDisembarkation||linked.length>0||draft.allAboardTime||shown('allAboardTime'))&&<>      <fieldset className={styles.formGroup}><legend>Hạn hành khách trở lại tàu</legend><div className={styles.grid}><Field htmlFor="stop-aboard-day" label="Ngày trở lại"><select id="stop-aboard-day" value={draft.allAboardDayNumber??''} disabled={readOnly} onChange={e=>change('allAboardDayNumber',e.target.value?Number(e.target.value):null)}><option value="">Chưa chọn</option>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select></Field><Field htmlFor="stop-aboard" label="Giờ hạn trở lại" error={shown('allAboardTime')}><input id="stop-aboard" type="time" step={timeStep(draft.allAboardTime)} value={draft.allAboardTime??''} disabled={readOnly} aria-invalid={Boolean(shown('allAboardTime'))} onBlur={touch('allAboardTime')} onChange={e=>change('allAboardTime',e.target.value||null)}/></Field></div>
      </fieldset></>}
      {(port||Boolean(draft.visits?.length))&&<DestinationVisits readOnly={readOnly} port={port ? { name: port.name ?? port.label, countryCode: port.countryCode, destinationId: port.destinationId } : undefined} visits={draft.visits??[]} onChange={visits=>change('visits',visits)}/>}
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
  const [draft,setDraft]=useState<Entry>(()=>structuredClone(entry??{clientKey:newKey(),dayNumber,kind,sourceId:null,serviceId:null,stopClientKey:kind==='SHORE_EXCURSION'&&content.stops.some(s=>s.clientKey===initialStopClientKey)?initialStopClientKey!:null,title:'',startDayNumber:dayNumber,plannedStartTime:'',endDayNumber:dayNumber,plannedEndTime:'',timeZoneId:kind==='SHORE_EXCURSION'?'':SHIP_ZONE,locationText:'',meetingPoint:'',notes:''})),[attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({})
  const change=<K extends keyof Entry>(field:K,value:Entry[K])=>setDraft(old=>({...old,[field]:value}))
  const stop=content.stops.find(s=>s.clientKey===draft.stopClientKey),zone=kind==='SHORE_EXCURSION'?stop?.timeZoneId:SHIP_ZONE,errors:Record<string,string>={}
  const sources=useSources(kind==='ONBOARD_ACTIVITY'?'activities':'excursions',{keyword,category:categoryFilter,portId:kind==='SHORE_EXCURSION'?stop?.portId:undefined},kind!=='SHORE_EXCURSION'||Boolean(stop))
  const filtering=Boolean(keyword.trim()||categoryFilter)
  const chosen=sources.data.find(source=>source.id===draft.sourceId)??(filtering&&retained?.id===draft.sourceId?retained:undefined)
  function search(value:string){if(chosen)setRetained(chosen);setKeyword(value)}
  function filterCategory(value:string){if(chosen)setRetained(chosen);setCategoryFilter(value)}

  if(!draft.sourceId||!chosen)errors.sourceId='Chọn nguồn hợp lệ từ danh mục.'
  if(onboard&&(draft.locationText?.length??0)>255)errors.locationText='Địa điểm tối đa 255 ký tự.'
  if(!draft.title.trim())errors.title='Nhập tiêu đề.'
  if(draft.title.length>200)errors.title='Tiêu đề tối đa 200 ký tự.'
  if(!draft.plannedStartTime)errors.plannedStartTime='Nhập giờ bắt đầu.'
  if(!draft.plannedEndTime||timeNumber(draft.endDayNumber,draft.plannedEndTime)<=timeNumber(draft.startDayNumber,draft.plannedStartTime))errors.plannedEndTime='Kết thúc phải sau bắt đầu.'
  if(draft.startDayNumber<1||draft.endDayNumber>content.days.length)errors.plannedEndTime='Thời gian phải nằm trong các ngày của lịch trình.'
  if(kind==='SHORE_EXCURSION') {
    if(chosen?.portId&&stop&&chosen.portId!==stop.portId)errors.sourceId='Nguồn tham quan không thuộc cảng của lần ghé đã chọn.'
    if(!stop)errors.stop='Chọn lần ghé cảng.'

    if(!validTimeZone(zone))errors.stop='Lần ghé cảng chưa có múi giờ hợp lệ.'
    if(stop&&(!stop.allAboardDayNumber||!stop.allAboardTime))errors.stop='Cần bổ sung hạn trở lại tàu trong lần ghé trước khi thêm tham quan.'
    if(stop && timeNumber(draft.startDayNumber,draft.plannedStartTime)<timeNumber(stop.arrivalDayNumber,stop.plannedArrivalTime)){
      errors.plannedStartTime='Tour bờ phải bắt đầu sau khi tàu đến cảng hoặc đúng giờ đến.'
    }
    if(stop && timeNumber(draft.endDayNumber,draft.plannedEndTime)>Math.min(
      timeNumber(stop.departureDayNumber,stop.plannedDepartureTime),
      timeNumber(stop.allAboardDayNumber??stop.departureDayNumber,stop.allAboardTime??stop.plannedDepartureTime),
    ))errors.plannedEndTime='Tour bờ phải kết thúc trước giờ tàu rời và không muộn hơn hạn trở lại tàu.'
  }
  const shown=(field:string)=>server.errorFor(field)??(attempted||touched[field]?errors[field]:undefined)
  const touch=(field:string)=>()=>setTouched(old=>({...old,[field]:true}))
  const daySelect=(value:number,onChange:(n:number)=>void,id:string)=><select id={id} value={value} disabled={readOnly} onChange={e=>onChange(Number(e.target.value))}>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select>
  function apply(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();setAttempted(true);if(readOnly)return
    if(Object.keys(errors).length||sources.loading||sources.error){focusError('entry-draft');return}
    const saved={...draft,dayNumber:draft.startDayNumber,timeZoneId:zone!,serviceId:null}
    onApply([saved]);onClose()
  }
  return <Modal variant="drawer" wide title={`${readOnly?'Xem':entry?'Chỉnh':'Thêm'} ${kindLabels[kind].toLocaleLowerCase('vi')}`} onClose={onClose} protectChanges={!readOnly} footer={<><Button tone="secondary" data-overlay-dismiss onClick={onClose}>{readOnly?'Đóng':'Hủy'}</Button>{!readOnly&&<Button type="submit" form="entry-draft" disabled={sources.loading||Boolean(sources.error)||!chosen}>{entry?'Cập nhật mục':'Thêm vào lịch trình'}</Button>}</>}>
    <form tabIndex={-1} onChangeCapture={server.dismiss} id="entry-draft" className={styles.single} onSubmit={e=>apply(e)} noValidate>
      {server.notice}
      {kind==='SHORE_EXCURSION'&&<Field htmlFor="entry-stop" label="Cảng tổ chức" error={shown('stop')}><input id="entry-stop" value={stop?.portName??'Không tìm thấy cảng'} readOnly aria-invalid={Boolean(shown('stop'))}/></Field>}
      {kind==='ONBOARD_ACTIVITY'&&!readOnly&&<Field htmlFor="entry-category-filter" label="Nhóm hoạt động" error={categories.error||undefined}><select id="entry-category-filter" value={categoryFilter} disabled={categories.loading||Boolean(categories.error)||sources.loading} onChange={e=>filterCategory(e.target.value)}><option value="">Tất cả nhóm</option>{categories.data.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>{categories.error&&<Button type="button" tone="text" onClick={categories.retry}>Tải lại nhóm</Button>}</Field>}
      {(kind!=='SHORE_EXCURSION'||stop)&&<SourcePicker id="entry-source" label={kind==='ONBOARD_ACTIVITY'?'Hoạt động *':'Tour tham quan trên bờ *'} placeholder={kind==='ONBOARD_ACTIVITY'?'Chọn hoạt động':'Chọn tour tham quan tại cảng này'} emptyMessage={kind==='SHORE_EXCURSION'?'Cảng này chưa có tour tham quan trên bờ trong danh mục.':'Danh mục chưa có nguồn phù hợp.'} value={draft.sourceId??''} selectedLabel={draft.title} selectedSource={chosen} options={sources.data} loading={sources.loading} loadError={sources.error} error={shown('sourceId')} readOnly={readOnly} retry={()=>{setRetained(undefined);sources.retry()}} onBlur={touch('sourceId')} searchValue={keyword} onSearch={search} filtered={Boolean(categoryFilter)} onChange={id=>{const source=sources.data.find(item=>item.id===id);if(source){setDraft(old=>selectEntrySource(old,source,chosen));setRetained(source)}else{change('sourceId',null);setRetained(undefined)}}}/>}
      {(draft.categoryName||draft.displayLocation||draft.referenceShipName)&&<div className={styles.sourceContext}>{draft.categoryName&&<span>{draft.categoryName}</span>}{draft.referenceShipName&&<span>Tàu tham chiếu: {draft.referenceShipName}</span>}{draft.displayLocation&&<span>Vị trí tham chiếu: {draft.displayLocation}</span>}</div>}
      <Field htmlFor="entry-title" label="Tiêu đề *" error={shown('title')}><input id="entry-title" maxLength={200} value={draft.title??''} disabled={readOnly} aria-invalid={Boolean(shown('title'))} onBlur={touch('title')} onChange={e=>change('title',e.target.value)}/></Field>
      {kind!=='SHORE_EXCURSION'&&<p className={styles.timeContext}>Giờ Việt Nam</p>}
      <div className={styles.grid}><Field htmlFor="entry-start-day" label="Ngày bắt đầu">{daySelect(draft.startDayNumber,n=>change('startDayNumber',n),'entry-start-day')}</Field><Field htmlFor="entry-start" label="Giờ bắt đầu *" error={shown('plannedStartTime')}><input id="entry-start" type="time" step={timeStep(draft.plannedStartTime)} value={draft.plannedStartTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedStartTime'))} onBlur={touch('plannedStartTime')} onChange={e=>change('plannedStartTime',e.target.value)}/></Field><Field htmlFor="entry-end-day" label="Ngày kết thúc">{daySelect(draft.endDayNumber,n=>change('endDayNumber',n),'entry-end-day')}</Field><Field htmlFor="entry-end" label="Giờ kết thúc *" error={shown('plannedEndTime')}><input id="entry-end" type="time" step={timeStep(draft.plannedEndTime)} value={draft.plannedEndTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedEndTime'))} onBlur={touch('plannedEndTime')} onChange={e=>change('plannedEndTime',e.target.value)}/></Field></div>
      {onboard&&<>
        <Field htmlFor="entry-location" label="Địa điểm tổ chức" error={shown('locationText')}><input id="entry-location" aria-invalid={Boolean(shown('locationText'))} aria-describedby="entry-meeting-help" onBlur={touch('locationText')} maxLength={255} value={draft.locationText??''} disabled={readOnly} onChange={e=>change('locationText',e.target.value)}/></Field>
        <Field htmlFor="entry-meeting" label="Điểm tập trung" error={shown('meetingPoint')}><input id="entry-meeting" maxLength={255} value={draft.meetingPoint??''} disabled={readOnly} aria-invalid={Boolean(shown('meetingPoint'))} aria-describedby="entry-meeting-help" onBlur={touch('meetingPoint')} onChange={e=>change('meetingPoint',e.target.value)}/><small id="entry-meeting-help">Trước khi chốt mẫu, điền địa điểm tổ chức hoặc điểm tập trung.</small></Field>
      </>}
      <Field htmlFor="entry-notes" label="Ghi chú"><textarea id="entry-notes" rows={3} value={draft.notes??''} disabled={readOnly} onChange={e=>change('notes',e.target.value)}/></Field>
    </form>
  </Modal>
}


