import { useEffect, useState } from 'react'
import { Button, Field, Modal, Notice } from '@/shared/ui'
import { validTimeZone } from '@/shared/lib/journey-time'
import { useSources } from '../hooks'
import { countryLabel, domesticRegionLabel, kindLabels, newKey, SHIP_ZONE, timeNumber, type Content, type Entry, type Stop, type Source, type TripInfo, type Violation } from '../model/plan'
import styles from '../Planning.module.css'
import { SourcePicker } from './SourcePicker'
import { scheduleDayLabel, stopRoleLabel } from '../model/day-labels'
import { selectEntrySource } from '../model/source-selection'
import { violationTarget, violationFieldId } from '../model/violation-target'
import { EntryDetails, StopDetails } from './PlanDetails'
import { overlappingStops, portMatchesScope, routeOrderViolations } from '../model/port-rules'

function useViolationField(violation:Violation|undefined,formId:string,readOnly:boolean){
  const [dismissed,setDismissed]=useState<Violation|null>(null),target=violation?violationTarget(violation):null
  useEffect(()=>{if(!violation)return;const element=document.getElementById(target?.fieldId??formId);element?.scrollIntoView({block:'center'});if(readOnly)document.getElementById(formId)?.focus();else element?.focus()},[violation,target?.fieldId,formId,readOnly])
  return {dismiss:(event:React.FormEvent<HTMLFormElement>)=>{if(event.target instanceof HTMLElement&&(event.target.id===target?.fieldId||(violation?.code==='CLIENT_STOP_TIME_OVERLAP'&&['stop-arrival-day','stop-arrival','stop-departure-day','stop-departure','stop-port'].includes(event.target.id))))setDismissed(violation??null)},errorFor:(field:string)=>dismissed!==violation&&Boolean(target?.fieldId)&&target?.fieldId===violationFieldId(formId==='stop-draft'?'stops':'entries',field)?violation?.message:undefined,notice:dismissed!==violation&&violation?<Notice title="Nội dung cần chỉnh sửa" tone="warning">{violation.message}</Notice>:null}
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
  const ports=useSources('ports',{tripId},Boolean(tripId),tripRevision),[draft,setDraft]=useState<Stop>(()=>structuredClone(stop??{clientKey:newKey(),portId:'',portName:'',stopOrder:Math.max(0,...content.stops.map(s=>s.stopOrder))+1,arrivalDayNumber:dayNumber,plannedArrivalTime:'',departureDayNumber:dayNumber,plannedDepartureTime:'',callType:'NORMAL',arrivalMethod:'BERTH',allAboardDayNumber:null,allAboardTime:null,isEmbarkation:dayNumber===1&&!content.days.find(day=>day.dayNumber===1)?.departurePortId&&!content.stops.some(s=>s.isEmbarkation),isDisembarkation:dayNumber===content.days.length&&!content.stops.some(s=>s.isDisembarkation)}))
  const [attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({})
  const change=<K extends keyof Stop>(field:K,value:Stop[K])=>setDraft(old=>({...old,[field]:value}))
  const errors:Record<string,string>={}
  const port=ports.data.find(p=>p.id===draft.portId),zone=port?.timeZoneId??draft.timeZoneId
  const linked=content.entries.filter(e=>e.kind==='SHORE_EXCURSION'&&e.stopClientKey===draft.clientKey)
  const eligiblePorts=ports.data.filter(item=>portMatchesScope(item,tripInfo))
  const conflicts=overlappingStops({...draft,timeZoneId:zone},content.stops)
  if(!port&&!ports.loading&&!ports.error)errors.portId=draft.portId?'Cảng đã chọn không còn trong danh mục hiện tại. Hãy chọn lại.':'Chọn cảng phù hợp với chuyến đi.'
  else if(port&&!portMatchesScope(port,tripInfo))errors.portId='Cảng không thuộc quốc gia hoặc miền đã chọn cho chuyến đi.'
  const routeIssue=routeOrderViolations({stops:[...content.stops.filter(item=>item.clientKey!==draft.clientKey),{...draft,timeZoneId:zone}]}).find(issue=>issue.clientKey===draft.clientKey)
  if(routeIssue)errors.plannedArrivalTime=routeIssue.message
  if(conflicts.length)errors.plannedArrivalTime='Thời gian ghé chồng với '+conflicts.map(item=>'lần ghé '+item.stopOrder+' · '+(item.portName??'Cảng')).join(', ')+'. Điều chỉnh giờ dự kiến đến/rời.'
  if(port&&!validTimeZone(zone))errors.portId='Cảng chưa có múi giờ IANA hợp lệ.'
  if(!draft.plannedArrivalTime)errors.plannedArrivalTime='Nhập giờ đến.'
  if(!draft.plannedDepartureTime)errors.plannedDepartureTime='Nhập giờ rời.'
  if(!Number.isInteger(draft.stopOrder)||draft.stopOrder<1||content.stops.some(s=>s.clientKey!==draft.clientKey&&s.stopOrder===draft.stopOrder))errors.stopOrder='Thứ tự phải là số nguyên dương, không trùng lần ghé khác.'
  if(timeNumber(draft.departureDayNumber,draft.plannedDepartureTime)<=timeNumber(draft.arrivalDayNumber,draft.plannedArrivalTime))errors.plannedDepartureTime='Ngày/giờ rời phải sau ngày/giờ đến.'
  if(content.days.some(day=>day.dayType==='SEA_DAY'&&day.dayNumber>=draft.arrivalDayNumber&&day.dayNumber<=draft.departureDayNumber))errors.plannedArrivalTime='Khoảng ghé cảng đi qua ngày trên biển. Hãy chọn ngày xuống bờ trước khi thêm cảng.'
  if(draft.isEmbarkation&&draft.arrivalDayNumber!==1)errors.embarkation='Cảng hành khách lên tàu phải ở Ngày 1. Hãy sửa ngày hoặc bỏ lựa chọn này.'
  if(draft.isDisembarkation&&draft.departureDayNumber!==content.days.length)errors.disembarkation='Cảng hành khách kết thúc chuyến phải ở ngày cuối. Hãy sửa ngày hoặc bỏ lựa chọn này.'
  if(Boolean(draft.allAboardDayNumber)!==Boolean(draft.allAboardTime))errors.allAboardTime='Nhập cả ngày và giờ hạn trở lại tàu.'
  if(linked.length&&(!draft.allAboardDayNumber||!draft.allAboardTime))errors.allAboardTime='Lần ghé có tour tham quan trên bờ cần hạn trở lại tàu.'
  if(draft.allAboardDayNumber&&draft.allAboardTime&&(timeNumber(draft.allAboardDayNumber,draft.allAboardTime)>timeNumber(draft.departureDayNumber,draft.plannedDepartureTime)||timeNumber(draft.allAboardDayNumber,draft.allAboardTime)<=timeNumber(draft.arrivalDayNumber,draft.plannedArrivalTime)))errors.allAboardTime='Hạn trở lại phải nằm trong khoảng ghé cảng.'
  if(stop&&linked.length&&draft.portId!==stop.portId)errors.portId='Xử lý các tham quan đang liên kết trước khi đổi cảng.'
  if(linked.some(e=>timeNumber(e.startDayNumber,e.plannedStartTime)<timeNumber(draft.arrivalDayNumber,draft.plannedArrivalTime)||timeNumber(e.endDayNumber,e.plannedEndTime)>timeNumber(draft.allAboardDayNumber??draft.departureDayNumber,draft.allAboardTime??draft.plannedDepartureTime)))errors.allAboardTime='Tour tham quan trên bờ đang liên kết vượt khoảng ghé hoặc hạn trở lại mới.'
  const shown=(field:string)=>server.errorFor(field)??(attempted||touched[field]?errors[field]:undefined)
  const touch=(field:string)=>()=>setTouched(old=>({...old,[field]:true}))
  const days=(value:number,onChange:(n:number)=>void,id:string)=> <select id={id} value={value} disabled={readOnly} onChange={e=>onChange(Number(e.target.value))}>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select>
  function apply(event:React.SubmitEvent<HTMLFormElement>) {event.preventDefault();setAttempted(true);if(readOnly)return;if(Object.keys(errors).length||ports.loading||ports.error){focusError('stop-draft');return}onApply({...draft,portName:port!.name??port!.label,timeZoneId:zone,countryCode:port?.countryCode??draft.countryCode,domesticRegion:port?.domesticRegion??null});onClose()}
  return <Modal variant="drawer" wide title={(stop?'Chỉnh sửa ':'Thêm ')+stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation).toLocaleLowerCase('vi')} onClose={onClose} protectChanges={!readOnly} footer={<><Button tone="secondary" onClick={onClose}>{readOnly?'Đóng':'Hủy'}</Button>{!readOnly&&<Button type="submit" form="stop-draft" disabled={ports.loading||Boolean(ports.error)||!eligiblePorts.length}>{stop?'Cập nhật lần ghé':'Thêm vào lịch trình'}</Button>}</>}>
    <p className={styles.timeContext}>Giờ địa phương của cảng</p>
    <form tabIndex={-1} onChangeCapture={server.dismiss} id="stop-draft" className={styles.single} onSubmit={e=>apply(e)} noValidate>
      {server.notice}<SourcePicker id="stop-port" label={stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation)+' *'} placeholder={'Chọn '+stopRoleLabel(draft.isEmbarkation,draft.isDisembarkation).toLocaleLowerCase('vi')} emptyMessage="Không có cảng phù hợp với phạm vi, quốc gia và miền đã chọn. Kiểm tra thông tin chuyến hoặc danh mục cảng." value={draft.portId} selectedLabel={draft.portName} options={eligiblePorts} loading={ports.loading} loadError={ports.error} error={shown('portId')} readOnly={readOnly} retry={ports.retry} onBlur={touch('portId')} onChange={id=>{const selected=ports.data.find(p=>p.id===id);setDraft(old=>({...old,portId:id,portName:selected?.name??selected?.label,timeZoneId:selected?.timeZoneId,countryCode:selected?.countryCode,domesticRegion:selected?.domesticRegion??null,destinationId:selected?.destinationId??null}))}}/>
      <dl className={styles.portContext}><div><dt>Quốc gia / vùng lãnh thổ</dt><dd>{countryLabel(port?.countryCode??draft.countryCode)}</dd></div><div><dt>Múi giờ cảng</dt><dd>{zone??'Chưa xác định'}</dd></div></dl>
      {(port?.countryCode??draft.countryCode)==='VN'&&<p className={styles.muted}>{domesticRegionLabel(port?.domesticRegion??draft.domesticRegion)}</p>}
      <fieldset className={styles.formGroup}><legend>{draft.isDisembarkation?'Thời gian cập cảng và trả khách':'Thời gian tàu ghé cảng'}</legend><div className={styles.grid}><Field htmlFor="stop-arrival-day" label="Ngày tàu đến *">{days(draft.arrivalDayNumber,n=>change('arrivalDayNumber',n),'stop-arrival-day')}</Field><Field htmlFor="stop-arrival" label="Giờ tàu dự kiến đến *" error={shown('plannedArrivalTime')}><input id="stop-arrival" type="time" step={timeStep(draft.plannedArrivalTime)} value={draft.plannedArrivalTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedArrivalTime'))} onBlur={touch('plannedArrivalTime')} onChange={e=>change('plannedArrivalTime',e.target.value)}/></Field><Field htmlFor="stop-departure-day" label={draft.isDisembarkation?"Ngày hoàn tất trả khách *":"Ngày tàu rời *"}>{days(draft.departureDayNumber,n=>change('departureDayNumber',n),'stop-departure-day')}</Field><Field htmlFor="stop-departure" label={draft.isDisembarkation?"Giờ hoàn tất trả khách *":"Giờ tàu dự kiến rời *"} error={shown('plannedDepartureTime')}><input id="stop-departure" type="time" step={timeStep(draft.plannedDepartureTime)} value={draft.plannedDepartureTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedDepartureTime'))} onBlur={touch('plannedDepartureTime')} onChange={e=>change('plannedDepartureTime',e.target.value)}/></Field></div>
      </fieldset><div className={styles.grid}><Field htmlFor="stop-call" label="Loại lần ghé"><select id="stop-call" value={draft.callType} disabled={readOnly} onChange={e=>change('callType',e.target.value as Stop['callType'])}><option value="NORMAL">Thông thường</option><option value="LATE_NIGHT">Ghé cảng ban đêm</option><option value="OVERNIGHT">Qua đêm</option></select></Field><Field htmlFor="stop-method" label={draft.isDisembarkation?"Cách khách xuống tàu":"Cách lên bờ"}><select id="stop-method" value={draft.arrivalMethod} disabled={readOnly} onChange={e=>change('arrivalMethod',e.target.value as Stop['arrivalMethod'])}><option value="BERTH">Cập bến</option><option value="TENDER">Trung chuyển bằng tàu nhỏ</option></select></Field></div>
      <fieldset className={styles.formGroup}><legend>Hạn hành khách trở lại tàu</legend><div className={styles.grid}><Field htmlFor="stop-aboard-day" label="Ngày hạn hành khách trở lại tàu"><select id="stop-aboard-day" value={draft.allAboardDayNumber??''} disabled={readOnly} onChange={e=>change('allAboardDayNumber',e.target.value?Number(e.target.value):null)}><option value="">Chưa chọn</option>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select></Field><Field htmlFor="stop-aboard" label="Giờ hạn hành khách trở lại tàu" error={shown('allAboardTime')}><input id="stop-aboard" type="time" step={timeStep(draft.allAboardTime)} value={draft.allAboardTime??''} disabled={readOnly} aria-invalid={Boolean(shown('allAboardTime'))} onBlur={touch('allAboardTime')} onChange={e=>change('allAboardTime',e.target.value||null)}/></Field></div>
      </fieldset><Field htmlFor="stop-order" label="Thứ tự ghé cảng *" error={shown('stopOrder')}><input id="stop-order" type="number" min={1} step={1} value={draft.stopOrder} disabled={readOnly} aria-invalid={Boolean(shown('stopOrder'))} onBlur={touch('stopOrder')} onChange={e=>change('stopOrder',Number(e.target.value))}/></Field>
      <div className={styles.checks}><label><input type="checkbox" id="stop-embarkation" checked={draft.isEmbarkation} aria-invalid={Boolean(errors.embarkation)} disabled={readOnly||(draft.arrivalDayNumber!==1&&!draft.isEmbarkation)} onChange={e=>change('isEmbarkation',e.target.checked)}/>Cảng khởi hành · Hành khách lên tàu ngày 1</label><label><input type="checkbox" id="stop-disembarkation" checked={draft.isDisembarkation} aria-invalid={Boolean(errors.disembarkation)} disabled={readOnly||(draft.departureDayNumber!==content.days.length&&!draft.isDisembarkation)} onChange={e=>change('isDisembarkation',e.target.checked)}/>Cảng kết thúc · Hành khách xuống tàu ngày cuối</label></div>
      {(errors.embarkation||errors.disembarkation)&&<p className={styles.error} role="alert">{errors.embarkation??errors.disembarkation}</p>}
    </form>
  </Modal>
}

export function EntryDrawer(props:EntryDrawerProps) {
  return props.readOnly?<EntryDetails content={props.content} entry={props.entry} kind={props.kind} onClose={props.onClose} violation={props.violation}/>:<EntryForm {...props}/>
}

function EntryForm({content,dayNumber,readOnly,entry,kind,initialStopClientKey,onClose,onApply,violation}:EntryDrawerProps) {
  const server=useViolationField(violation,'entry-draft',readOnly)
  const [keyword,setKeyword]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[retained,setRetained]=useState<Source>()
  const categories=useSources('activityCategories',{},kind==='ONBOARD_ACTIVITY')
  const [draft,setDraft]=useState<Entry>(()=>structuredClone(entry??{clientKey:newKey(),dayNumber,kind,sourceId:null,serviceId:null,stopClientKey:kind==='SHORE_EXCURSION'&&content.stops.some(s=>s.clientKey===initialStopClientKey)?initialStopClientKey!:null,title:'',startDayNumber:dayNumber,plannedStartTime:'',endDayNumber:dayNumber,plannedEndTime:'',timeZoneId:kind==='SHORE_EXCURSION'?'':SHIP_ZONE,locationText:'',meetingPoint:'',notes:''})),[repeated,setRepeated]=useState<number[]>([dayNumber]),[attempted,setAttempted]=useState(false),[touched,setTouched]=useState<Record<string,boolean>>({})
  const change=<K extends keyof Entry>(field:K,value:Entry[K])=>setDraft(old=>({...old,[field]:value}))
  const stop=content.stops.find(s=>s.clientKey===draft.stopClientKey),zone=kind==='SHORE_EXCURSION'?stop?.timeZoneId:SHIP_ZONE,errors:Record<string,string>={}
  const sources=useSources(kind==='ONBOARD_ACTIVITY'?'activities':kind==='SHORE_EXCURSION'?'excursions':'services',{keyword,category:categoryFilter,portId:kind==='SHORE_EXCURSION'?stop?.portId:undefined},kind!=='SHORE_EXCURSION'||Boolean(stop))
  const filtering=Boolean(keyword.trim()||categoryFilter)
  const chosen=sources.data.find(source=>source.id===draft.sourceId)??(filtering&&retained?.id===draft.sourceId?retained:undefined)
  function search(value:string){if(chosen)setRetained(chosen);setKeyword(value)}
  function filterCategory(value:string){if(chosen)setRetained(chosen);setCategoryFilter(value)}

  if(!draft.sourceId||!chosen)errors.sourceId='Chọn nguồn hợp lệ từ danh mục.'
  if((draft.locationText?.length??0)>255)errors.locationText='Địa điểm tối đa 255 ký tự.'
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
    if(stop&&(timeNumber(draft.startDayNumber,draft.plannedStartTime)<timeNumber(stop.arrivalDayNumber,stop.plannedArrivalTime)||timeNumber(draft.endDayNumber,draft.plannedEndTime)>timeNumber(stop.allAboardDayNumber??stop.departureDayNumber,stop.allAboardTime??stop.plannedDepartureTime)))errors.plannedEndTime='Tham quan phải nằm trong lần ghé và kết thúc không muộn hơn hạn trở lại tàu.'
  }
  if(kind==='SERVING_WINDOW'&&!entry&&(!repeated.length||repeated.some(n=>n+draft.endDayNumber-draft.startDayNumber>content.days.length)))errors.repeat='Chọn ngày áp dụng hợp lệ; các mục xuyên ngày không được vượt ngày cuối.'
  const shown=(field:string)=>server.errorFor(field)??(attempted||touched[field]?errors[field]:undefined)
  const touch=(field:string)=>()=>setTouched(old=>({...old,[field]:true}))
  const daySelect=(value:number,onChange:(n:number)=>void,id:string)=><select id={id} value={value} disabled={readOnly} onChange={e=>onChange(Number(e.target.value))}>{content.days.map(d=><option key={d.key} value={d.dayNumber}>{scheduleDayLabel(d.dayNumber,content.days.length)}</option>)}</select>
  function apply(event:React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();setAttempted(true);if(readOnly)return
    if(Object.keys(errors).length||sources.loading||sources.error){focusError('entry-draft');return}
    const saved={...draft,dayNumber:draft.startDayNumber,timeZoneId:zone!,serviceId:kind==='SERVING_WINDOW'?draft.sourceId:draft.serviceId}
    const rows=kind==='SERVING_WINDOW'&&!entry?[...repeated].sort((a,b)=>a-b).map(day=>({...saved,clientKey:day===draft.startDayNumber?draft.clientKey:newKey(),dayNumber:day,startDayNumber:day,endDayNumber:day+draft.endDayNumber-draft.startDayNumber})):[saved]
    onApply(rows);onClose()
  }
  return <Modal variant="drawer" wide title={`${readOnly?'Xem':entry?'Chỉnh':'Thêm'} ${kindLabels[kind].toLocaleLowerCase('vi')}`} onClose={onClose} protectChanges={!readOnly} footer={<><Button tone="secondary" onClick={onClose}>{readOnly?'Đóng':'Hủy'}</Button>{!readOnly&&<Button type="submit" form="entry-draft" disabled={sources.loading||Boolean(sources.error)||!chosen}>{entry?'Cập nhật mục':'Thêm vào lịch trình'}</Button>}</>}>
    <form tabIndex={-1} onChangeCapture={server.dismiss} id="entry-draft" className={styles.single} onSubmit={e=>apply(e)} noValidate>
      {server.notice}
      {kind==='SHORE_EXCURSION'&&<Field htmlFor="entry-stop" label="Lần ghé cảng *" error={shown('stop')}><select id="entry-stop" value={draft.stopClientKey??''} disabled={readOnly} aria-invalid={Boolean(shown('stop'))} onBlur={touch('stop')} onChange={e=>{const key=e.target.value||null,nextStop=content.stops.find(item=>item.clientKey===key);if(nextStop?.portId!==stop?.portId){setRetained(undefined);setKeyword('');setDraft(old=>({...old,stopClientKey:key,sourceId:null,sourceExcursionId:null,destinationId:null}))}else change('stopClientKey',key)}}><option value="">Chọn lần ghé</option>{content.stops.map(s=><option key={s.clientKey} value={s.clientKey}>{s.stopOrder}. {s.portName??'Cảng'} · Ngày {s.arrivalDayNumber}–{s.departureDayNumber}</option>)}</select></Field>}
      {kind==='ONBOARD_ACTIVITY'&&!readOnly&&<Field htmlFor="entry-category-filter" label="Nhóm hoạt động" error={categories.error||undefined}><select id="entry-category-filter" value={categoryFilter} disabled={categories.loading||Boolean(categories.error)||sources.loading} onChange={e=>filterCategory(e.target.value)}><option value="">Tất cả nhóm</option>{categories.data.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>{categories.error&&<Button type="button" tone="text" onClick={categories.retry}>Tải lại nhóm</Button>}</Field>}
      {(kind!=='SHORE_EXCURSION'||stop)&&<SourcePicker id="entry-source" label={kind==='SERVING_WINDOW'?'Dịch vụ *':kind==='ONBOARD_ACTIVITY'?'Hoạt động *':'Tour tham quan trên bờ *'} placeholder={kind==='SERVING_WINDOW'?'Chọn dịch vụ':kind==='ONBOARD_ACTIVITY'?'Chọn hoạt động':'Chọn tour tham quan tại cảng này'} emptyMessage={kind==='SHORE_EXCURSION'?'Cảng này chưa có tour tham quan trên bờ trong danh mục.':'Danh mục chưa có nguồn phù hợp.'} value={draft.sourceId??''} selectedLabel={draft.title} selectedSource={chosen} options={sources.data} loading={sources.loading} loadError={sources.error} error={shown('sourceId')} readOnly={readOnly} retry={()=>{setRetained(undefined);sources.retry()}} onBlur={touch('sourceId')} searchValue={keyword} onSearch={search} filtered={Boolean(categoryFilter)} onChange={id=>{const source=sources.data.find(item=>item.id===id);if(source){setDraft(old=>selectEntrySource(old,source,chosen));setRetained(source)}else{change('sourceId',null);setRetained(undefined)}}}/>}
      {(draft.categoryName||draft.displayLocation||draft.referenceShipName)&&<div className={styles.sourceContext}>{draft.categoryName&&<span>{draft.categoryName}</span>}{draft.referenceShipName&&<span>Tàu tham chiếu: {draft.referenceShipName}</span>}{draft.displayLocation&&<span>Vị trí tham chiếu: {draft.displayLocation}</span>}</div>}
      <Field htmlFor="entry-title" label="Tiêu đề *" error={shown('title')}><input id="entry-title" maxLength={200} value={draft.title??''} disabled={readOnly} aria-invalid={Boolean(shown('title'))} onBlur={touch('title')} onChange={e=>change('title',e.target.value)}/></Field>
      <p className={styles.timeContext}>{kind==='SHORE_EXCURSION'?`Giờ địa phương cảng · ${zone??'Chưa chọn cảng'}`:'Giờ Việt Nam'}</p>
      <div className={styles.grid}><Field htmlFor="entry-start-day" label="Ngày bắt đầu">{daySelect(draft.startDayNumber,n=>change('startDayNumber',n),'entry-start-day')}</Field><Field htmlFor="entry-start" label="Giờ bắt đầu *" error={shown('plannedStartTime')}><input id="entry-start" type="time" step={timeStep(draft.plannedStartTime)} value={draft.plannedStartTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedStartTime'))} onBlur={touch('plannedStartTime')} onChange={e=>change('plannedStartTime',e.target.value)}/></Field><Field htmlFor="entry-end-day" label="Ngày kết thúc">{daySelect(draft.endDayNumber,n=>change('endDayNumber',n),'entry-end-day')}</Field><Field htmlFor="entry-end" label="Giờ kết thúc *" error={shown('plannedEndTime')}><input id="entry-end" type="time" step={timeStep(draft.plannedEndTime)} value={draft.plannedEndTime??''} disabled={readOnly} aria-invalid={Boolean(shown('plannedEndTime'))} onBlur={touch('plannedEndTime')} onChange={e=>change('plannedEndTime',e.target.value)}/></Field></div>
      <Field htmlFor="entry-location" label={kind==='ONBOARD_ACTIVITY'?'Địa điểm tổ chức':'Địa điểm (tùy chọn)'} error={shown('locationText')}><input id="entry-location" aria-invalid={Boolean(shown('locationText'))} onBlur={touch('locationText')} maxLength={255} value={draft.locationText??''} disabled={readOnly} onChange={e=>change('locationText',e.target.value)}/></Field>
      <Field htmlFor="entry-meeting" label={kind==='SHORE_EXCURSION'?'Điểm tập trung (cần trước khi chốt mẫu)':'Điểm tập trung (tùy chọn)'} error={shown('meetingPoint')}><input id="entry-meeting" maxLength={255} value={draft.meetingPoint??''} disabled={readOnly} aria-invalid={Boolean(shown('meetingPoint'))} aria-describedby="entry-meeting-help" onBlur={touch('meetingPoint')} onChange={e=>change('meetingPoint',e.target.value)}/><small id="entry-meeting-help">{kind==='SHORE_EXCURSION'?'Có thể bổ sung sau, trước khi chốt mẫu.':kind==='ONBOARD_ACTIVITY'?'Cần địa điểm tổ chức hoặc điểm tập trung trước khi chốt mẫu.':''}</small></Field>
      <Field htmlFor="entry-notes" label="Ghi chú"><textarea id="entry-notes" rows={3} value={draft.notes??''} disabled={readOnly} onChange={e=>change('notes',e.target.value)}/></Field>
      {kind==='SERVING_WINDOW'&&!entry&&<fieldset disabled={readOnly}><legend>Áp dụng cho nhiều ngày</legend><p className={styles.muted}>Tạo một mục riêng cho từng ngày. Sau khi áp dụng, sửa hoặc xóa riêng từng mục.</p><div className={styles.checks}>{content.days.map(d=><label key={d.key}><input type="checkbox" checked={repeated.includes(d.dayNumber)} onChange={()=>setRepeated(old=>old.includes(d.dayNumber)?old.filter(n=>n!==d.dayNumber):[...old,d.dayNumber])}/>Ngày {d.dayNumber}</label>)}</div>{attempted&&errors.repeat&&<p className={styles.error} role="alert">{errors.repeat}</p>}</fieldset>}
    </form>
  </Modal>
}
