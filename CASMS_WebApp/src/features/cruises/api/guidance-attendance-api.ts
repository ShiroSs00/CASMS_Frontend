import {ApiError,apiRequest} from '@/shared/api'

export type GuidanceAttendanceStatus='Registered'|'Attended'|'Absent'
export type GuidanceAttendanceSession={guidanceSessionId:string;cruiseId:string;sessionName:string;startAt:string;status:'Scheduled'|'Published'|'Completed'|'Cancelled';attendedCount:number;totalParticipants:number}
export type GuidanceAttendee={sessionId:string;bookingPassengerId:string;passengerFullName:string;attendanceStatus:GuidanceAttendanceStatus}
export type GuidanceAttendanceAction={kind:'populate'}|{kind:'attendance';bookingPassengerId:string;attendanceStatus:'Attended'|'Absent'}|{kind:'complete'}
const root='/checkin/guidance-sessions'
const path=(id:string)=>`${root}/${encodeURIComponent(id)}`
const fault=()=>new ApiError('Dữ liệu buổi hướng dẫn chưa đầy đủ hoặc không khớp chuyến. Tải lại trước khi thao tác.',502)
function object(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))throw fault();return value as Record<string,unknown>}
function text(value:unknown){if(typeof value!=='string'||!value.trim())throw fault();return value}
function count(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw fault();return value}
function session(value:unknown,cruiseId:string):GuidanceAttendanceSession{
  const r=object(value),startAt=text(r.startAt)
  if(r.cruiseId!==cruiseId||!Number.isFinite(Date.parse(startAt))||!['Scheduled','Published','Completed','Cancelled'].includes(String(r.status)))throw fault()
  const attendedCount=count(r.attendedCount),totalParticipants=count(r.totalParticipants)
  if(attendedCount>totalParticipants)throw fault()
  return{guidanceSessionId:text(r.guidanceSessionId),cruiseId,sessionName:text(r.sessionName),startAt,status:r.status as GuidanceAttendanceSession['status'],attendedCount,totalParticipants}
}
function attendee(value:unknown,sessionId:string):GuidanceAttendee{
  const r=object(value)
  if(r.sessionId!==sessionId||!['Registered','Attended','Absent'].includes(String(r.attendanceStatus)))throw fault()
  // Deliberately project only operational display fields, never identificationNumber.
  return{sessionId,bookingPassengerId:text(r.bookingPassengerId),passengerFullName:text(r.passengerFullName),attendanceStatus:r.attendanceStatus as GuidanceAttendanceStatus}
}
export const guidanceAttendanceApi={
  async sessions(cruiseId:string,signal?:AbortSignal){
    const value=await apiRequest<unknown>(`${root}/cruise/${encodeURIComponent(cruiseId)}`,{signal})
    if(!Array.isArray(value))throw fault()
    const rows=value.map(item=>session(item,cruiseId))
    if(new Set(rows.map(row=>row.guidanceSessionId)).size!==rows.length)throw fault()
    return rows
  },
  async participants(sessionId:string,signal?:AbortSignal){
    const value=await apiRequest<unknown>(`${path(sessionId)}/participants`,{signal})
    if(!Array.isArray(value))throw fault()
    const rows=value.map(item=>attendee(item,sessionId))
    if(new Set(rows.map(row=>row.bookingPassengerId)).size!==rows.length)throw fault()
    return rows
  },
  async execute(cruiseId:string,sessionId:string,action:GuidanceAttendanceAction){
    if(action.kind==='populate'){
      count(await apiRequest<unknown>(`${path(sessionId)}/participants/auto-populate`,{method:'POST'}))
      await this.participants(sessionId)
      return
    }
    if(action.kind==='complete'){
      const saved=session(await apiRequest<unknown>(`${path(sessionId)}/status`,{method:'PATCH',query:{status:'Completed'}}),cruiseId)
      const actual=session(await apiRequest<unknown>(path(sessionId)),cruiseId)
      if(saved.guidanceSessionId!==sessionId||actual.guidanceSessionId!==sessionId||saved.status!=='Completed'||actual.status!=='Completed')throw fault()
      return
    }
    const saved=attendee(await apiRequest<unknown>(`${path(sessionId)}/attendance`,{method:'POST',body:{bookingPassengerId:action.bookingPassengerId,attendanceStatus:action.attendanceStatus}}),sessionId)
    const actual=(await this.participants(sessionId)).find(row=>row.bookingPassengerId===action.bookingPassengerId)
    if(saved.bookingPassengerId!==action.bookingPassengerId||saved.attendanceStatus!==action.attendanceStatus||actual?.attendanceStatus!==action.attendanceStatus)throw fault()
  },
}
