import type { Violation } from './plan'

const stopFields:Record<string,string>={port:'stop-port',portId:'stop-port',arrivalDayNumber:'stop-arrival-day',plannedArrivalTime:'stop-arrival',departureDayNumber:'stop-departure-day',plannedDepartureTime:'stop-departure',allAboardDayNumber:'stop-aboard-day',allAboardTime:'stop-aboard',stopOrder:'stop-order',callType:'stop-call',arrivalMethod:'stop-method',isEmbarkation:'stop-embarkation',isDisembarkation:'stop-disembarkation'}
const entryFields:Record<string,string>={sourceActivityId:'entry-source',sourceExcursionId:'entry-source',serviceId:'entry-source',title:'entry-title',dayNumber:'entry-start-day',startDayNumber:'entry-start-day',start:'entry-start',plannedStartTime:'entry-start',endDayNumber:'entry-end-day',end:'entry-end',plannedEndTime:'entry-end',stopClientKey:'entry-stop',locationText:'entry-location',meetingPoint:'entry-meeting',notes:'entry-notes',category:'entry-source',deckId:'entry-location',cabinId:'entry-location'}
export const violationFieldId=(kind:'stops'|'entries',field:string)=>(kind==='stops'?stopFields:entryFields)[field==='stop'?'stopClientKey':field==='sourceId'?'serviceId':field]
export function violationTarget(violation:Violation){
  const path=violation.fieldPath??'',match=/^(stops|entries)\[clientKey=([^\]]+)\]\.([A-Za-z]+)$/.exec(path),day=/^days\[(\d+)\]\.([A-Za-z]+)$/.exec(path)
  const kind=match?.[1]??(violation.entityType==='STOP'?'stops':violation.entityType==='ENTRY'?'entries':day?'days':'')
  const field=match?.[3]??day?.[2]??violation.field??''
  return {kind,key:violation.clientKey??match?.[2],dayNumber:violation.dayNumber??(day?Number(day[1]):undefined),fieldId:kind==='stops'?stopFields[field]:kind==='entries'?entryFields[field]:kind==='days'?(field==='dayType'?'planning-day-type':field==='title'?'planning-day-title':field==='departurePortId'?'planning-departure-port':field==='plannedDepartureTime'?'planning-departure-time':undefined):undefined}
}
