import {ApiError,apiRequest} from '@/shared/api'

export type ScopedActivity={id:string;cruiseId:string;name:string;description:string|null;startTime:string;endTime:string;location:string;deckId:string|null;cabinId:string|null;capacity:number|null;price:number|null;currencyCode:string|null}
export type ActivityInput=Omit<ScopedActivity,'id'|'name'|'capacity'|'price'|'currencyCode'>&{activityName:string;capacity:number;price:number;currencyCode:string}
const root=(id:string)=>`/cruise-plans/${encodeURIComponent(id)}/activities`
export function activityCapacityConflict(reason:unknown):number|null{
 if(!(reason instanceof ApiError)||reason.code!=='CAPACITY_BELOW_ALLOCATED'||!reason.details||typeof reason.details!=='object')return null
 const details=reason.details as Record<string,unknown>,count=details.allocatedParticipants
 return details.fieldPath==='capacity'&&typeof count==='number'&&Number.isSafeInteger(count)&&count>=0?count:null
}
export function activityScheduleConflict(reason:unknown):'startTime'|'endTime'|null{
 if(!(reason instanceof ApiError)||reason.code!=='ACTIVITY_OUTSIDE_CRUISE'||!reason.details||typeof reason.details!=='object')return null
 const field=(reason.details as Record<string,unknown>).fieldPath
 return field==='startTime'||field==='endTime'?field:null
}
export function decodeActivities(value:ScopedActivity[],cruiseId:string):ScopedActivity[]{
 if(!Array.isArray(value)||value.some(a=>!a||a.cruiseId!==cruiseId||typeof a.id!=='string'||!a.id||typeof a.name!=='string'||!Number.isFinite(Date.parse(a.startTime))||!Number.isFinite(Date.parse(a.endTime))||typeof a.location!=='string'))throw new ApiError('',502)
 return value
}
export async function updateScopedActivity(cruiseId:string,id:string,revision:number,body:ActivityInput){
 if(body.cruiseId!==cruiseId)throw new ApiError('',403,'CROSS_CRUISE_ACCESS')
 const saved=await apiRequest<ScopedActivity>(root(cruiseId)+'/'+encodeURIComponent(id),{method:'PUT',ifMatch:revision,body})
 const rows=decodeActivities(await apiRequest<ScopedActivity[]>(root(cruiseId)),cruiseId),actual=rows.find(a=>a.id===id)
 if(saved.id!==id||saved.cruiseId!==cruiseId||!actual||Object.entries(body).some(([key,value])=>{
  const found=actual[key==='activityName'?'name':key as keyof ScopedActivity]
  return key==='startTime'||key==='endTime'?Date.parse(String(found))!==Date.parse(String(value)):found!==value
 }))throw new ApiError('',502)
 return actual
}
