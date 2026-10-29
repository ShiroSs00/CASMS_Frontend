import { Button, Field, Panel } from '@/shared/ui'
import { SHIP_ZONE, domesticRegionLabel, kindLabels, shortTime, type Content, type Day, type Entry, type Stop, type Violation } from '../model/plan'
import { dayAgenda, type AgendaRow } from '../model/day-agenda'
import { violationTarget } from '../model/violation-target'
import styles from '../Planning.module.css'

type Props={content:Content;day:Day;editable:boolean;tab:'route'|'program';busy:boolean;violation?:Violation|null;onType:(type:Day['dayType'])=>void;onTitle:(title:string)=>void;onStop:(stop?:Stop)=>void;onEntry:(kind:Entry['kind'],entry?:Entry,stopClientKey?:string)=>void;onRemoveStop:(stop:Stop)=>void;onRemoveEntry:(entry:Entry)=>void;onOrder:(key:string,target:string)=>void}
export function DayPane({content,day,editable,tab,busy,violation,onType,onTitle,onStop,onEntry,onRemoveStop,onRemoveEntry,onOrder}:Props) {
  const target=violation?violationTarget(violation):null
  const fieldError=(id:string)=>target?.dayNumber===day.dayNumber&&target?.fieldId===id?violation?.message:undefined
  const stops=content.stops.filter(s=>s.arrivalDayNumber<=day.dayNumber&&s.departureDayNumber>=day.dayNumber).sort((a,b)=>a.stopOrder-b.stopOrder)
  const ordered=[...content.stops].sort((a,b)=>a.stopOrder-b.stopOrder)
  const agenda=dayAgenda(content,day.dayNumber)
  function agendaRow(row:AgendaRow,stopTarget:boolean) {
    if(row.type==='milestone') return <article id={stopTarget?`planning-${row.stop.clientKey}`:undefined} key={row.key} className={`${styles.agendaRow} ${styles.milestone}`}>
      <div className={styles.agendaTime}>{row.time?shortTime(row.time):row.label==='Tiếp tục ghé cảng'?'Tiếp diễn':'Chưa có giờ'}</div>
      <div className={styles.agendaBody}><h3>{row.label} · {row.stop.portName??'Cảng'}</h3><p className={styles.agendaMeta}>{row.label==='Tiếp tục ghé cảng'?`Cùng lần ghé từ Ngày ${row.stop.arrivalDayNumber}`:`Lần ghé ${row.stop.stopOrder}`}</p></div>
      <Button tone="text" disabled={busy} onClick={()=>onStop(row.stop)}>Xem lần ghé</Button>
    </article>
    const entry=row.entry,continuation=entry.startDayNumber!==day.dayNumber
    return <article id={`planning-${entry.clientKey}`} key={row.key} className={styles.agendaRow}>
      <div className={styles.agendaTime}>{continuation?'Tiếp diễn':shortTime(entry.plannedStartTime)}<span>{entry.endDayNumber===day.dayNumber?`đến ${shortTime(entry.plannedEndTime)}`:`đến Ngày ${entry.endDayNumber} ${shortTime(entry.plannedEndTime)}`}</span></div>
      <div className={styles.agendaBody}><span className={styles.agendaKind}>{kindLabels[entry.kind]}</span><h3>{entry.title||kindLabels[entry.kind]}</h3>
        {continuation&&<p className={styles.agendaMeta}>Từ Ngày {entry.startDayNumber} {shortTime(entry.plannedStartTime)} · Chỉnh sửa áp dụng cho toàn bộ mục.</p>}
        {(entry.meetingPoint||entry.locationText||entry.displayLocation)&&<p className={styles.agendaMeta}>{[entry.meetingPoint?`Tập trung: ${entry.meetingPoint}`:null,(entry.locationText||entry.displayLocation)?.trim()!==entry.meetingPoint?.trim()?entry.locationText||entry.displayLocation:null].filter(Boolean).join(' · ')}</p>}
        {(entry.deckId||entry.cabinId)&&<p className={styles.agendaMeta}>{entry.referenceShipName?`Tàu tham chiếu: ${entry.referenceShipName}`:'Vị trí tham chiếu theo hoạt động nguồn'}</p>}
        {entry.categoryName&&<p className={styles.agendaMeta}>{entry.categoryName}</p>}{entry.notes&&<p>{entry.notes}</p>}
      </div><div className={styles.actions}><Button tone="text" disabled={busy} onClick={()=>onEntry(entry.kind,entry)}>{editable?'Chỉnh sửa':'Xem chi tiết'}</Button>{editable&&!continuation&&<Button tone="text" disabled={busy} onClick={()=>onRemoveEntry(entry)}>Xóa mục</Button>}</div>
    </article>
  }
  return <div className={styles.dayPane}>
    {editable&&tab==='route'?<Panel title={`Ngày ${day.dayNumber}`}><div className={styles.grid}><Field htmlFor="planning-day-type" label="Ngày này ở đâu?" error={fieldError('planning-day-type')}><select id="planning-day-type" aria-invalid={Boolean(fieldError('planning-day-type'))} value={day.dayType??''} disabled={!editable||busy} onChange={e=>onType(e.target.value as Day['dayType'])}><option value="">Chọn ngày trên biển hoặc ghé cảng</option><option value="SEA_DAY">Ngày trên biển</option><option value="PORT_DAY">Ngày ghé cảng</option></select></Field><Field htmlFor="planning-day-title" label="Tên ngày (tùy chọn)" error={fieldError('planning-day-title')}><input id="planning-day-title" placeholder="Nhập tên cho ngày này" aria-invalid={Boolean(fieldError('planning-day-title'))} value={day.title??''} disabled={!editable||busy} maxLength={200} onChange={e=>onTitle(e.target.value)}/></Field></div></Panel>:<dl className={styles.daySummary}><div><dt>Ngày {day.dayNumber}</dt><dd id="planning-day-type" tabIndex={-1}>{day.dayType==='SEA_DAY'?'Ngày trên biển':day.dayType==='PORT_DAY'?'Ngày ghé cảng':'Chưa chọn loại ngày'}</dd>{fieldError('planning-day-type')&&<p className={styles.error}>{fieldError('planning-day-type')}</p>}</div><div><dt>Tên ngày</dt><dd id="planning-day-title" tabIndex={-1}>{day.title||'Chưa đặt tên'}</dd>{fieldError('planning-day-title')&&<p className={styles.error}>{fieldError('planning-day-title')}</p>}</div></dl>}
    {tab==='route'?(editable&&!day.dayType?null:<Panel title="Cảng ghé trong ngày"><div className={styles.sectionTitle}><span className={styles.muted}>Giờ địa phương của từng cảng</span>{editable&&day.dayType==='PORT_DAY'&&stops.length>0&&<Button disabled={busy} onClick={()=>onStop()}>Thêm lần ghé cảng</Button>}</div>
      {!stops.length?<div className={styles.empty}><strong>{day.dayType==='SEA_DAY'?'Ngày trên biển':day.dayType==='PORT_DAY'?'Chọn cảng ghé cho ngày này':'Bắt đầu bằng loại ngày'}</strong>{editable&&day.dayType==='PORT_DAY'&&<Button disabled={busy} onClick={()=>onStop()}>Thêm lần ghé cảng</Button>}{editable&&!day.dayType&&<Button tone="secondary" disabled={busy} onClick={()=>document.getElementById('planning-day-type')?.focus()}>Chọn loại ngày</Button>}</div>:<div className={styles.cards}>{stops.map(stop=>{
        const index=ordered.findIndex(s=>s.clientKey===stop.clientKey)
        return <article id={`planning-${stop.clientKey}`} key={stop.clientKey} className={styles.item} draggable={editable&&!busy} onDragStart={e=>e.dataTransfer.setData('text/plain',stop.clientKey)} onDragOver={e=>{if(editable&&!busy)e.preventDefault()}} onDrop={e=>{if(editable&&!busy){e.preventDefault();onOrder(e.dataTransfer.getData('text/plain'),stop.clientKey)}}}>
          <div className={styles.cardHead}><div><h3>{stop.stopOrder}. {stop.portName??'Cảng'}</h3><p>Dự kiến: Ngày {stop.arrivalDayNumber} {shortTime(stop.plannedArrivalTime)} → Ngày {stop.departureDayNumber} {shortTime(stop.plannedDepartureTime)}</p><p className={styles.muted}>{stop.timeZoneId??'Múi giờ cảng cần đối chiếu'} · {stop.callType==='OVERNIGHT'?'Qua đêm':stop.callType==='LATE_NIGHT'?'Ghé cảng ban đêm':'Thông thường'}{stop.isEmbarkation?' · Hành khách lên tàu':''}{stop.isDisembarkation?' · Hành khách kết thúc chuyến':''}</p>{stop.countryCode==='VN'&&<p className={styles.muted}>{domesticRegionLabel(stop.domesticRegion)}</p>}{stop.allAboardTime&&<p>Hạn hành khách trở lại tàu: Ngày {stop.allAboardDayNumber} {shortTime(stop.allAboardTime)}</p>}{stop.arrivalDayNumber<day.dayNumber&&<p className={styles.muted}>Tiếp diễn cùng lần ghé từ Ngày {stop.arrivalDayNumber}.</p>}</div><div className={styles.actions}><Button tone="text" disabled={busy} onClick={()=>onStop(stop)}>{editable?'Chỉnh sửa':'Xem chi tiết'}</Button>{editable&&<><Button tone="text" disabled={busy||index===0} onClick={()=>onOrder(stop.clientKey,ordered[index-1].clientKey)}>Lên</Button><Button tone="text" disabled={busy||index===ordered.length-1} onClick={()=>onOrder(stop.clientKey,ordered[index+1].clientKey)}>Xuống</Button><Button tone="text" disabled={busy} onClick={()=>onRemoveStop(stop)}>Xóa lần ghé</Button></>}</div></div>
        </article>
      })}</div>}
    </Panel>):<Panel title="Chương trình trong ngày">
      {editable&&<div className={styles.agendaToolbar}><div className={styles.actions}>
        <Button disabled={busy} onClick={()=>onEntry('ONBOARD_ACTIVITY')}>Thêm hoạt động trên tàu</Button>
        <Button tone="secondary" disabled={busy||!stops.length} aria-describedby={!stops.length?'planning-shore-reason':undefined} onClick={()=>onEntry('SHORE_EXCURSION',undefined,stops.length===1?stops[0].clientKey:undefined)}>Thêm tour tham quan trên bờ</Button>
        <Button tone="secondary" disabled={busy} onClick={()=>onEntry('SERVING_WINDOW')}>Thêm khung phục vụ</Button>
      </div>{!stops.length&&<p id="planning-shore-reason" className={styles.muted}>Thêm lần ghé cảng trong Tuyến tàu để lập tour tham quan trên bờ.</p>}</div>}
      {agenda.length>1&&<p className={styles.muted}>Chương trình được xếp theo giờ trong từng múi giờ. Các nhóm dùng đồng hồ địa phương khác nhau.</p>}
      {!agenda.length?<p className={styles.empty}>Chưa có chương trình hoặc mốc ghé cảng trong ngày.</p>:<div className={styles.agenda}>{agenda.map(group=>{
        const targetedStops=new Set<string>()
        return <section className={styles.agendaGroup} key={group.key} aria-label={`Giờ ${group.clocks.join(', ')}`}><h3>{group.timeZoneId===SHIP_ZONE?'Giờ Việt Nam':`Giờ cảng · ${group.clocks.join(', ')}`} {group.timeZoneId!==SHIP_ZONE&&<span className={styles.muted}>{group.timeZoneId??'Chưa có múi giờ cảng'}</span>}</h3>
          {group.rows.map(row=>{
            const stopTarget=row.type==='milestone'&&!targetedStops.has(row.stop.clientKey)
            if(row.type==='milestone')targetedStops.add(row.stop.clientKey)
            return agendaRow(row,stopTarget)
          })}
        </section>
      })}</div>}
    </Panel>}
  </div>
}
