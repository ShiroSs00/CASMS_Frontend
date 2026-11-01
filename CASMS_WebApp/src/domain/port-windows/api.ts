import { apiRequest } from '@/shared/api'
export type PortWindow = {windowId:string;windowType:'ARRIVAL'|'DEPARTURE';validFrom:string;validTo:string|null;daysOfWeek:string[];localStartTime:string;localEndTime:string;sourceType:'PORT_AUTHORITY'|'PORT_AGENT';sourceReference:string;sourceEffectiveDate:string|null;overnightAllowed:boolean|null;maxStayMinutes:number|null;verificationStatus:'UNVERIFIED'|'VERIFIED';lifecycleStatus:'ACTIVE'|'INACTIVE';verifiedBy:string|null;verifiedAt:string|null;verifiedTimeZoneId:string|null;revision:number;createdAt:string;updatedAt:string}
export type PortClosure = Omit<PortWindow,'windowId'|'windowType'|'daysOfWeek'|'localStartTime'|'localEndTime'|'overnightAllowed'|'maxStayMinutes'> & {exceptionId:string;exceptionType:'CLOSURE';reason:string;validTo:string}
export type WindowDirectory={portId:string;portTimeZoneId:string;windows:PortWindow[];exceptions:PortClosure[]}
export type WindowWrite=Pick<PortWindow,'windowType'|'validFrom'|'validTo'|'daysOfWeek'|'localStartTime'|'localEndTime'|'sourceType'|'sourceReference'|'sourceEffectiveDate'|'overnightAllowed'|'maxStayMinutes'> & {expectedRevision?:number}
export type ClosureWrite=Pick<PortClosure,'validFrom'|'validTo'|'reason'|'sourceType'|'sourceReference'|'sourceEffectiveDate'> & {expectedRevision?:number}
const root=(portId:string)=>`/ports/${encodeURIComponent(portId)}/call-windows`
export const portWindowApi={
 read:(id:string,signal?:AbortSignal)=>apiRequest<WindowDirectory>(root(id),{signal}),
 write:(portId:string,body:WindowWrite,id?:string)=>apiRequest<PortWindow>(root(portId)+(id?`/${id}`:''),{method:id?'PUT':'POST',body}),
 closure:(portId:string,body:ClosureWrite,id?:string)=>apiRequest<PortClosure>(root(portId)+'/exceptions'+(id?`/${id}`:''),{method:id?'PUT':'POST',body}),
 verify:(portId:string,id:string,expectedRevision:number,exception=false)=>apiRequest(root(portId)+(exception?'/exceptions':'')+`/${id}/verify`,{method:'POST',body:{expectedRevision}}),
 lifecycle:(portId:string,id:string,expectedRevision:number,lifecycleStatus:'ACTIVE'|'INACTIVE',exception=false)=>apiRequest(root(portId)+(exception?'/exceptions':'')+`/${id}/lifecycle`,{method:'PATCH',body:{expectedRevision,lifecycleStatus}}),
 history:(portId:string,id:string,exception=false)=>apiRequest<{content:{auditId:string;occurredAt:string;actorUserId:string;action:string;detail:string}[]}>(root(portId)+(exception?'/exceptions':'')+`/${id}/history`,{query:{page:0,size:20}}),
}
