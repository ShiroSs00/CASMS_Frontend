import { PlanningFault } from './gateway'
import type { CurrentTrip, CurrentVersion, CurrentSaveContent } from './current-contract'
import type { Trip, Version, Content } from '../model/plan'
import { SHIP_ZONE } from '../model/plan'
import { durationRules, supportedDuration } from '../model/duration'

export function tripView(raw: CurrentTrip): Trip {
  if (!raw || typeof raw.tripId !== 'string' || typeof raw.name !== 'string' || !Number.isSafeInteger(raw.revision) || !Number.isInteger(raw.durationDays) || !['DRAFT','READY','ARCHIVED'].includes(raw.status)) throw new PlanningFault('Dữ liệu chuyến không đúng định dạng.',502)
  const rules=raw.durationGroup&&supportedDuration(raw.durationGroup)?durationRules[raw.durationGroup]:null
  const consistent=rules&&raw.durationDays>=rules.minDays&&raw.durationDays<=rules.maxDays
  return { ...raw, durationIssue:consistent?undefined:'Nhóm thời lượng và số ngày từ máy chủ chưa đầy đủ hoặc chưa khớp. Cần đối soát dữ liệu trước khi thay đổi số ngày.', info: { name: raw.name, description: raw.description ?? '', durationBand: raw.durationGroup==='SHORT'||raw.durationGroup==='LONG'?raw.durationGroup:'', scope: raw.plannedScope === 'DOMESTIC' || raw.plannedScope === 'INTERNATIONAL' ? raw.plannedScope : '', regionIds: raw.domesticRegions ?? [], countryCodes: raw.countryCodes ?? [] } }
}
export function versionView(raw: CurrentVersion): Version {
  if (!raw || typeof raw.versionId !== 'string' || !Number.isSafeInteger(raw.revision) || !['DRAFT','IN_REVIEW','PUBLISHED','CANCELLED'].includes(raw.status) || !Array.isArray(raw.days) || !Array.isArray(raw.stops) || !Array.isArray(raw.entries)) throw new PlanningFault('Dữ liệu phiên bản chưa đầy đủ. Không thể ghi đè nội dung.',502)
  if (raw.stops.some(s => !s.clientKey) || raw.entries.some(e => !e.clientKey)) throw new PlanningFault('Phiên bản có nội dung chưa có khóa ổn định. Cần cập nhật dữ liệu máy chủ trước khi sửa.',422)
  return { ...raw, days: raw.days.map(d => ({...d,key:d.dayId ?? `${raw.versionId}:day:${d.dayNumber}`})), stops: raw.stops.map(s=>({...s})), entries: raw.entries.map(e=>({...e,sourceId:e.kind==='SERVING_WINDOW'?e.serviceId:e.kind==='ONBOARD_ACTIVITY'?e.sourceActivityId??null:e.sourceExcursionId??null})) }
}
const localTime = (value: string | null) => {
  if(!value)return value
  const result=value.length===5?value+':00':value
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(result))throw new PlanningFault('Giờ phải theo định dạng HH:mm:ss, không có Z hoặc phần mili giây.',422,'INVALID_LOCAL_TIME')
  return result
}
export function contentRequest(version: Version, content: Content): CurrentSaveContent {
  return {
    expectedRevision: version.revision,
    days: content.days.map(d=>({dayNumber:d.dayNumber,dayType:d.dayType,shipTimeZoneId:SHIP_ZONE,title:d.title,description:d.description})),
    stops: content.stops.map(s=>({clientKey:s.clientKey,portId:s.portId,destinationId:s.destinationId??null,stopOrder:s.stopOrder,arrivalDayNumber:s.arrivalDayNumber,plannedArrivalTime:localTime(s.plannedArrivalTime),departureDayNumber:s.departureDayNumber,plannedDepartureTime:localTime(s.plannedDepartureTime),callType:s.callType,arrivalMethod:s.arrivalMethod,allAboardDayNumber:s.allAboardDayNumber,allAboardTime:localTime(s.allAboardTime),isEmbarkation:s.isEmbarkation,isDisembarkation:s.isDisembarkation})),
    entries: content.entries.map(e=>({clientKey:e.clientKey,dayNumber:e.startDayNumber,kind:e.kind,stopClientKey:e.stopClientKey??null,sourceActivityId:e.kind==='ONBOARD_ACTIVITY'?e.sourceId:e.sourceActivityId??null,sourceExcursionId:e.kind==='SHORE_EXCURSION'?e.sourceId:e.sourceExcursionId??null,serviceId:e.kind==='SERVING_WINDOW'?e.sourceId:e.serviceId,seriesClientKey:e.seriesClientKey??null,destinationId:e.destinationId??null,title:e.title,startDayNumber:e.startDayNumber,plannedStartTime:localTime(e.plannedStartTime)!,endDayNumber:e.endDayNumber,plannedEndTime:localTime(e.plannedEndTime)!,timeZoneId:e.kind==='SHORE_EXCURSION'?e.timeZoneId:SHIP_ZONE,category:e.category??null,deckId:e.deckId??null,cabinId:e.cabinId??null,locationText:e.locationText,meetingPoint:e.meetingPoint,notes:e.notes})),
  }
}
