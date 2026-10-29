import { DepartureCommand } from './DepartureCommand'

import {CruiseSale} from './CruiseSale'
import { departureManagementApi } from '../api/departure-management-api'
import { useCallback, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { journeyTime, validTimeZone, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, Panel, RecordFacts } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import { cruiseApi } from '../api/cruise-api'
import { type ChangeInput, type DepartureSchedule } from '../model/departure-contract'
import type { CruiseRecord } from '../model/cruise-record'
import { scheduleInstant } from '../model/cruise-validation'
import { allowedDepartureSections, type DepartureSection } from '../model/preparation'

const shown = (value: string | number | null | undefined) => value ?? 'Chưa xác định'
const yesNo = (value: boolean | null) => value === true ? 'Có' : value === false ? 'Không' : 'Chưa xác định'
function time(value: string | null, zone: string | null) { return value && zone && validTimeZone(zone) ? journeyTime(value, zone) : value ? value + ' · Chưa xác định giờ địa phương' : 'Chưa xác định' }
const dayLabels: Record<string, string> = { EMBARKATION_DAY: 'Ngày đón khách', DISEMBARKATION_DAY: 'Ngày trả khách', PORT_DAY: 'Ngày ghé cảng', SEA_DAY: 'Ngày trên biển' }
const kindLabels: Record<string, string> = { ONBOARD_ACTIVITY: 'Hoạt động trên tàu', SHORE_EXCURSION: 'Tour tham quan trên bờ', SERVICE_WINDOW: 'Khung phục vụ', SERVING_WINDOW: 'Khung phục vụ' }
const taskLabels: Record<string, string> = { PENDING: 'Chờ xử lý', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý', BLOCKING: 'Chặn', WARNING: 'Cảnh báo' }
export function ReadState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
  if (loading) return <Loading label="Đang tải thông tin…" />
  if (error) return <Notice title={error instanceof ApiError && error.status === 403 ? 'Chưa có quyền xem' : 'Chưa tải được thông tin'} tone="error"><p>{error.message}</p><Button tone="secondary" onClick={retry}>Thử lại</Button></Notice>
  return null
}

export function ScheduleContents({ schedule, preview = false,cruiseId }: { schedule: DepartureSchedule; preview?: boolean;cruiseId?:string }) {
  const access=useSessionAccess()
  return <div>
    {schedule.days.some(day=>day.shipTimeZoneId!==SHIP_TIME_ZONE)&&<Notice title="Cần đối chiếu cơ sở ngày của lịch" tone="warning">Múi giờ trong lịch trả về chưa khớp giờ tàu Việt Nam. Các thời điểm được giữ nguyên; cần xác nhận lịch từ hệ thống trước khi sử dụng.</Notice>}
    <RecordFacts entries={[[preview ? 'Bắt đầu dự kiến' : 'Bắt đầu theo phản hồi', time(schedule.departureDatetime, 'Asia/Ho_Chi_Minh')], ['Kết thúc dự kiến', time(schedule.returnDatetime, 'Asia/Ho_Chi_Minh')]]} />
    {!schedule.days.length && <Empty title="Chưa có ngày trong phản hồi lịch trình" />}
    {schedule.days.map(day => <Panel key={day.dayNumber} title={`Ngày ${day.dayNumber} · ${day.calendarDate ?? 'Chưa có ngày'}${day.title ? ' · ' + day.title : ''}`} subtitle={(day.dayType ? dayLabels[day.dayType] ?? day.dayType : 'Chưa xác định loại ngày') + ' · Giờ tàu (Việt Nam)'}>
      {day.stops.map((stop, index) => <div key={stop.sourceStopId ?? `${day.dayNumber}:${stop.stopOrder ?? index}`}>
        <h3>Lần ghé {stop.stopOrder ?? index + 1} · {stop.portName ?? 'Chưa có tên cảng'}</h3>
        <RecordFacts entries={[
          ['Dự kiến đến · Giờ cảng', time(stop.plannedArrival, stop.portTimeZoneId)], ['Dự kiến rời · Giờ cảng', time(stop.plannedDeparture, stop.portTimeZoneId)],
          ['Hạn trở lại tàu', time(stop.allAboardTime, stop.portTimeZoneId)], ['Giờ cảng', stop.portTimeZoneId ?? 'Chưa xác định'],
          ['Tiếp cận', stop.arrivalMethod === 'BERTH' ? 'Cập bến' : stop.arrivalMethod === 'ANCHOR_TENDER' ? 'Neo và trung chuyển' : shown(stop.arrivalMethod)],
        ]} />
        {!preview&&cruiseId&&stop.cruiseStopId&&access.canDo('EXCURSION_CREATE')&&<ButtonLink tone="secondary" to={'/admin/shore-excursions/new?'+new URLSearchParams({cruiseId,cruiseStopId:stop.cruiseStopId,returnTo:'/admin/cruises/'+cruiseId+'?section=schedule'})}>Tạo tour cho lần ghé này</ButtonLink>}
      </div>)}
      {day.entries.length > 0 && <><h3>{preview ? 'Chương trình từ lịch trình nguồn' : 'Chương trình trong phản hồi lịch'}</h3><ul>{day.entries.map((entry, index) => {
        const zone=entry.kind==='SHORE_EXCURSION'?day.stops.find(stop=>stop.stopOrder===entry.stopOrder)?.portTimeZoneId??null:SHIP_TIME_ZONE
        return <li key={entry.sourceEntryId ?? entry.clientKey ?? `${day.dayNumber}:${index}`}><strong>{entry.kind ? kindLabels[entry.kind] ?? entry.kind : 'Chưa xác định loại'}</strong><p>{time(entry.plannedStartTime, zone)} → {time(entry.plannedEndTime, zone)} · {entry.kind==='SHORE_EXCURSION'?'Giờ cảng':'Giờ tàu (Việt Nam)'}{entry.stopOrder != null ? ` · Lần ghé ${entry.stopOrder}` : ''}</p></li>
      })}</ul></>}
    </Panel>)}
  </div>
}

export function DepartureScheduleRead({ cruise }: { cruise: CruiseRecord }) {
  const query = useReadQuery(`departure-schedule:${cruise.cruiseId}:${cruise.revision ?? cruise.updatedAt}`, useCallback(signal => departureApi.schedule(cruise.cruiseId, signal), [cruise.cruiseId]))
  const mismatch = query.data && (query.data.sourceVersionId !== (cruise.sourceVersionId??null) || !query.data.departureDatetime || Date.parse(query.data.departureDatetime)!==Date.parse(cruise.departureDatetime) || !query.data.returnDatetime || Date.parse(query.data.returnDatetime)!==Date.parse(cruise.returnDatetime))
  return <Panel title="Lịch theo ngày thực tế" subtitle="Các mốc dự kiến do hệ thống trả về; giờ cảng và giờ tàu được ghi riêng.">
    <ReadState {...query} />
    {mismatch ? <Notice title="Lịch chưa khớp nguồn" tone="error">Phiên bản nguồn hoặc mốc thời gian trong lịch chưa khớp hồ sơ lần khởi hành. Tải lại để đối chiếu.</Notice> : query.data && <><RecordFacts entries={[["Lịch thực tế đã khởi tạo",yesNo(query.data.materialized)],['Trạng thái lịch thực tế',shown(query.data.itineraryStatus)],['Revision nguồn',shown(query.data.sourceVersionRevision)]]}/><ScheduleContents schedule={query.data} cruiseId={cruise.cruiseId}/><p>Lịch này chưa xác nhận các chương trình vận hành đã được tạo đầy đủ. Kiểm tra riêng tại Chương trình và dịch vụ.</p></>}
    <Button tone="secondary" onClick={query.retry}>Tải lại lịch</Button>
  </Panel>
}

export function DepartureInventory({ cruise }: { cruise: CruiseRecord }) {
  const access = useSessionAccess()
  const allowed = access.has('CRUISE_READ') || access.has('BOOKING_READ')
  const query = useReadQuery(`departure-inventory:${cruise.cruiseId}:${cruise.revision ?? cruise.updatedAt}:${allowed}`, useCallback(signal => allowed ? departureApi.inventory(cruise.cruiseId, signal) : Promise.resolve(null), [allowed, cruise.cruiseId]))
  if (!allowed) return null
  const data = query.data
  return <Panel title="Tồn và sức chứa"><ReadState {...query} />{data && <>
    <RecordFacts entries={[["Sức chứa vật lý của tàu", shown(data.physicalCapacity)], ['Hành khách đã đặt', shown(data.bookedPassengersCount)], ['Hành khách đang giữ chỗ', shown(data.heldPassengersCount)], ['Phần sức chứa còn lại', shown(data.remainingCapacity)], ['Tổng cabin', shown(data.totalCabins)], ['Cabin đang hoạt động', shown(data.operationalCabins)], ['Cabin bảo trì hoặc ngừng sử dụng', shown(data.blockedCabins)]]} />
    <p>Thông tin sức chứa chưa loại đầy đủ cabin bị khóa hoặc bảo trì. Các con số này không xác nhận số cabin hoặc suất được phép bán.</p>
    {data.cabinTypeInventory == null ? <p>Chưa có dữ liệu theo hạng cabin.</p> : !data.cabinTypeInventory.length ? <Empty title="Chưa có dữ liệu hạng cabin" /> : <DataTable label="Tồn theo hạng cabin" headers={['Hạng cabin', 'Tổng cabin', 'Cabin hoạt động', 'Bảo trì / ngừng sử dụng', 'Tổng suất hệ thống', 'Suất đã phân', 'Suất còn theo hệ thống']}>
      {data.cabinTypeInventory.map((item, index) => <tr key={item.cabinType ?? index}><td>{shown(item.cabinType)}</td><td>{shown(item.totalCabins)}</td><td>{shown(item.operationalCabins)}</td><td>{shown(item.blockedCabins)}</td><td>{shown(item.totalSlots)}</td><td>{shown(item.occupiedSlots)}</td><td>{shown(item.remainingSlots)}</td></tr>)}
    </DataTable>}
  </>}<Button tone="secondary" onClick={query.retry}>Tải lại tồn</Button></Panel>
}

export function DepartureSaleReadiness({cruise}:{cruise:CruiseRecord;onSection?:(section:DepartureSection)=>void}) {return <CruiseSale cruise={cruise}/>}

export function DepartureImpact({ cruise,onChanged }: { cruise: CruiseRecord;onChanged?:()=>void }) {
  const access = useSessionAccess(), canShips = access.has('SHIP_READ')
  const canPorts=access.has('PORT_READ')
  const ports=useReadQuery('impact-ports:'+canPorts+':'+cruise.sourceTripId,useCallback(signal=>canPorts?cruiseApi.listPorts(signal,cruise.sourceTripId??undefined):Promise.resolve(null),[canPorts,cruise.sourceTripId]))
  const [departurePortId,setDeparturePortId]=useState(''),[returnPortId,setReturnPortId]=useState('')
  const ships = useReadQuery('impact-ships:' + canShips, useCallback(signal => canShips ? cruiseApi.listShips(signal) : Promise.resolve(null), [canShips]))
  const [shipId, setShipId] = useState('')
  const [status, setStatus] = useState(''), [departure, setDeparture] = useState(''), [returnTime, setReturnTime] = useState(''), [reason, setReason] = useState('')
  const [requested, setRequested] = useState<{ key: string; input: ChangeInput } | null>(null)
  const [inputError, setInputError] = useState('')
  const inputKey = JSON.stringify([departure, returnTime, shipId, departurePortId,returnPortId,reason, cruise.revision, cruise.cruiseId])
  const tasks = useReadQuery(`departure-tasks:${cruise.cruiseId}:${status}:${cruise.revision ?? cruise.updatedAt}`, useCallback(signal => departureApi.tasks(cruise.cruiseId, status, signal), [cruise.cruiseId, status]))
  const current = requested?.key === inputKey ? requested : null
  const preview = useReadQuery('departure-change:' + cruise.cruiseId + ':' + (current?.key ?? 'none'), useCallback(signal => current ? departureApi.impact(cruise.cruiseId, current.input, signal) : Promise.resolve(null), [current, cruise.cruiseId]))
  function requestPreview() {
    try {
      if (!departure && !returnTime && !shipId&&!departurePortId&&!returnPortId) throw new Error('Chọn ít nhất một thay đổi dự kiến về ngày giờ, tàu hoặc cảng.')
      if (shipId && (!canShips || !ships.data?.some(ship => ship.shipId === shipId))) throw new Error('Tải lại danh sách và chọn tàu trước khi xem tác động.')
      if([departurePortId,returnPortId].some(id=>id&&(!canPorts||!ports.data?.some(port=>port.portId===id))))throw new Error('Tải lại danh sách và chọn cảng trong phạm vi lịch trình trước khi xem tác động.')
      const input: ChangeInput = { ...(departure ? { newDepartureDatetime: scheduleInstant(departure).toISOString() } : {}), ...(returnTime ? { newReturnDatetime: scheduleInstant(returnTime).toISOString() } : {}), ...(shipId ? { newShipId: shipId } : {}),...(departurePortId?{newDeparturePortId:departurePortId}:{}),...(returnPortId?{newReturnPortId:returnPortId}:{}), ...(cruise.revision != null ? { expectedRevision: cruise.revision } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}) }
      setInputError(''); setRequested({ key: inputKey, input })
    } catch (error) { setInputError(error instanceof Error ? error.message : 'Kiểm tra lại thời gian.') }
  }
  return <>
    <Panel title="Xem trước tác động thay đổi" >
      <Field htmlFor="impact-departure" label="Bắt đầu mới dự kiến · giờ Việt Nam"><input id="impact-departure" type="datetime-local" value={departure} onChange={e => setDeparture(e.target.value)} /></Field>
      <Field htmlFor="impact-return" label="Kết thúc mới dự kiến · giờ Việt Nam"><input id="impact-return" type="datetime-local" value={returnTime} onChange={e => setReturnTime(e.target.value)} /></Field>
      {canPorts&&<><ReadState {...ports}/>{[['impact-departure-port','Cảng khởi hành mới dự kiến',departurePortId,setDeparturePortId],['impact-return-port','Cảng kết thúc mới dự kiến',returnPortId,setReturnPortId]].map(([id,label,value,setter])=><Field key={String(id)} htmlFor={String(id)} label={String(label)}><select id={String(id)} value={String(value)} disabled={ports.loading||Boolean(ports.error)} onChange={event=>(setter as (value:string)=>void)(event.target.value)}><option value="">Không đề xuất đổi cảng</option>{ports.data?.map(port=><option key={port.portId} value={port.portId}>{port.portCode} · {port.portName}</option>)}</select></Field>)}</>}
      {canShips && <><ReadState {...ships} /><Field htmlFor="impact-ship" label="Tàu mới dự kiến"><select id="impact-ship" value={shipId} disabled={ships.loading || Boolean(ships.error)} onChange={e => setShipId(e.target.value)}><option value="">Không đề xuất đổi tàu</option>{ships.data?.map(ship => <option key={ship.shipId} value={ship.shipId}>{ship.shipName}</option>)}</select></Field></>}
      <Field htmlFor="impact-reason" label="Lý do dự kiến"><input id="impact-reason" value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Button tone="secondary" disabled={Boolean(current && preview.loading)} onClick={requestPreview}>Xem tác động</Button>
      {requested&&<Button tone="text" onClick={()=>{setRequested(null);setInputError('')}}>Bỏ kết quả xem trước</Button>}
      {inputError && <Notice title="Chưa xem trước được" tone="error">{inputError}</Notice>}
      {current && <><ReadState {...preview} />{preview.data && <><RecordFacts entries={[["Booking bị ảnh hưởng", shown(preview.data.affectedBookingsCount)], ['Hành khách đã đặt',shown(preview.data.bookedPassengersCount)], ['Hoạt động bị ảnh hưởng', shown(preview.data.affectedActivitiesCount)], ['Tour bờ bị ảnh hưởng', shown(preview.data.affectedExcursionsCount)]]} />{[...(preview.data.blockers ?? []), ...(preview.data.warnings ?? [])].map((item, index) => <p key={index}>{item}</p>)}<p>{preview.data.generatedTasks?.length ?? 'Chưa xác định'} công việc được đề xuất; chưa lưu vào hệ thống.</p><DepartureCommand key={current.key} label="Tạo công việc từ đánh giá này" disabledReason="Cần nhập lý do và có đánh giá khớp revision hiện tại trước khi tạo công việc." permissions={['CRUISE_UPDATE_DRAFT','CRUISE_STATUS_CHANGE','OPERATIONAL_ISSUE_CREATE']} disabled={preview.loading||Boolean(preview.error)||cruise.revision==null||preview.data.currentRevision==null||preview.data.currentRevision!==cruise.revision||!reason.trim()} run={()=>departureManagementApi.generateTasks(cruise.cruiseId,current.input)} onChanged={()=>{tasks.retry();onChanged?.()}} explanation="Lưu các công việc đề xuất; không tự đổi ngày hoặc tàu."/></>}</>}
    </Panel>
    <Panel title="Công việc xử lý tác động"><p>Hoàn tất công việc không xác nhận khách đã được thông báo. Chưa có xác nhận gửi/nhận thông báo từ hệ thống.</p>
      <Field htmlFor="impact-task-status" label="Lọc trạng thái"><select id="impact-task-status" value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả</option><option value="PENDING">Chờ xử lý</option><option value="RESOLVED">Đã xử lý</option></select></Field>
      <ReadState {...tasks} />{tasks.data && (!tasks.data.length ? <Empty title="Chưa có công việc trong bộ lọc này" /> : <ul>{tasks.data.map(task => <li key={task.taskId}><strong>{task.title ?? 'Chưa có tiêu đề'}</strong><p>{task.description}</p><p>{task.status ? taskLabels[task.status] ?? task.status : 'Chưa xác định trạng thái'} · Phụ trách: {shown(task.assignedToUsername)}</p>{task.evidence && <p>{task.evidence}</p>}{task.resolutionNotes && <p>Kết quả xử lý: {task.resolutionNotes}</p>}<p>{time(task.updatedAt, 'Asia/Ho_Chi_Minh')}</p>{task.taskId&&task.status==='PENDING'&&task.revision!=null&&<DepartureCommand key={task.taskId+':'+task.updatedAt} label="Ghi nhận đã xử lý" permissions={['CRUISE_UPDATE_DRAFT','CRUISE_STATUS_CHANGE','OPERATIONAL_ISSUE_RESOLVE']} reasonRequired run={notes=>departureManagementApi.resolveTask(cruise.cruiseId,task.taskId!,notes,task.revision??undefined)} onChanged={()=>{tasks.retry();onChanged?.()}} explanation="Chỉ ghi nhận sau khi đã hoàn tất phần việc thực tế. Thao tác này không tự sửa chương trình hoặc phân công."/>}</li>)}</ul>)}
    </Panel>
  </>
}

export function DepartureAudit({cruise}:{cruise:CruiseRecord}) {
  const access=useSessionAccess(),allowed=access.has('CRUISE_READ')||access.has('OPERATIONAL_ISSUE_READ')
  const key=JSON.stringify([cruise.cruiseId,cruise.revision,access.userId,access.status,access.permissions])
  const audit=useReadQuery('departure-audit:'+key,useCallback(signal=>allowed?departureApi.auditEvents(cruise.cruiseId,signal):Promise.resolve(null),[allowed,cruise.cruiseId]))
  const notifications=useReadQuery('departure-notifications:'+key,useCallback(signal=>allowed?departureApi.notificationAggregate(cruise.cruiseId,signal):Promise.resolve(null),[allowed,cruise.cruiseId]))
  if(!allowed)return null
  return <Panel title="Lịch sử và thông báo tác động" >
    <ReadState {...audit}/>{audit.data&&(!audit.data.length?<Empty title="Chưa có sự kiện được trả về"/>:<ul>{audit.data.map(event=><li key={event.eventId}><strong>{event.eventType??'Chưa xác định loại sự kiện'}</strong><p>{time(event.timestamp,SHIP_TIME_ZONE)} · Người thực hiện: {event.actorUsername??'Chưa xác định'} · Vai trò cần đối chiếu</p>{event.reason&&<p>{event.reason}</p>}</li>)}</ul>)}
    <Button tone="secondary" onClick={audit.retry}>Tải lại lịch sử</Button>
    <ReadState {...notifications}/>{notifications.data&&<><RecordFacts entries={[["Thông báo hệ thống ghi đã gửi",shown(notifications.data.notificationsSentCount)],['Đã đưa vào hộp thư trong ứng dụng',shown(notifications.data.inAppDeliveredCount)],['Đang chờ',shown(notifications.data.notificationsPendingCount)],['Lỗi',shown(notifications.data.notificationsFailedCount)],['Hệ thống ghi đã xác nhận',shown(notifications.data.notificationsAcknowledgedCount)]]}/><p>Số đã gửi là ghi nhận thông báo trong hệ thống, chưa xác nhận email được chuyển hoặc khách đã nhận. Trạng thái xác nhận đang cần đối chiếu.</p></>}
    <Button tone="secondary" onClick={notifications.retry}>Tải lại thông báo</Button>
  </Panel>
}

export function DepartureHandoff({ cruise, onGuests }: { cruise: CruiseRecord; onGuests?: () => void }) {
  const access = useSessionAccess()
  const query = useReadQuery(`departure-handoff:${cruise.cruiseId}:${cruise.revision ?? cruise.updatedAt}`, useCallback(signal => departureApi.handoff(cruise.cruiseId, signal), [cruise.cruiseId]))
  const data = query.data
  return <Panel title="Thông tin bàn giao vận hành" ><ReadState {...query} />{data && <>
    <RecordFacts entries={[["Mã lần khởi hành", shown(data.cruiseCode)], ['Nguồn', `${shown(data.sourceTripCode)} · Phiên bản ${shown(data.sourceVersionNumber)}`], ['Tàu', shown(data.shipName)], ['Tổng booking', shown(data.totalBookingsCount)], ['Booking đã xác nhận', shown(data.confirmedBookingsCount)], ['Booking nháp', shown(data.draftBookingsCount)], ['Booking đã hủy', shown(data.cancelledBookingsCount)], ['Tổng hành khách', shown(data.totalPassengersCount)], ['Hành khách đã check-in', shown(data.checkedInPassengersCount)], ['Hành khách đã lên tàu', shown(data.boardedPassengersCount)], ['Đã phân công thuyền trưởng', yesNo(data.captainAssigned)], ['Danh sách khách đã khóa', yesNo(data.manifestLocked)]]} />
    <p>Kết quả kiểm tra khởi hành trong phản hồi: {yesNo(data.departureClearanceReady)}. Đây chưa phải chứng nhận hoàn tất mọi điều kiện an toàn.</p>
    {onGuests && access.canDo('CRUISE_MANIFEST_READ') && allowedDepartureSections(access).some(([key]) => key === 'sales') && <Button tone="secondary" onClick={onGuests}>Xem danh sách hành khách của lần khởi hành</Button>}
  </>}</Panel>
}
