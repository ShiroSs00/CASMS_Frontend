import {ApiError,apiRequest} from '@/shared/api'
export type ExcursionCommercial={id:string;name:string;capacity:number;cruiseStopId?:string|null;startsAt?:string;endsAt?:string;location?:string|null;price:number|null;currency:string|null}
export function decodeCommercialExcursions(rows:ExcursionCommercial[]):ExcursionCommercial[]{
 if(!Array.isArray(rows)||rows.some(e=>!e||typeof e.id!=='string'||!e.id||typeof e.name!=='string'||!Number.isSafeInteger(e.capacity)||e.capacity<1||(e.price!==null&&(typeof e.price!=='number'||!Number.isFinite(e.price)||e.price<0))||(e.currency!==null&&typeof e.currency!=='string')))throw new ApiError('',502)
 return rows
}
export function excursionCapacityConflict(error:unknown):number|null{
 if(!(error instanceof ApiError)||error.code!=='CAPACITY_BELOW_ALLOCATED'||!error.details||typeof error.details!=='object')return null
 const d=error.details as Record<string,unknown>
 return d.fieldPath==='maximumCapacity'&&typeof d.allocatedParticipants==='number'&&Number.isSafeInteger(d.allocatedParticipants)&&d.allocatedParticipants>=0?d.allocatedParticipants:null
}
export async function updateExcursionCommercial(cruiseId:string,id:string,revision:number,body:{maximumCapacity:number;price:number;currencyCode:string}){
 const root=`/cruise-plans/${encodeURIComponent(cruiseId)}/excursions`
 const saved=await apiRequest<{shoreExcursionId:string;maximumCapacity:number;price:number;currencyCode:string}>(root+'/'+encodeURIComponent(id)+'/commercial',{method:'PATCH',ifMatch:revision,body})
 const actual=decodeCommercialExcursions(await apiRequest<ExcursionCommercial[]>(root)).find(e=>e.id===id)
 if(saved.shoreExcursionId!==id||saved.maximumCapacity!==body.maximumCapacity||saved.price!==body.price||saved.currencyCode!==body.currencyCode||!actual||actual.capacity!==body.maximumCapacity||actual.price!==body.price||actual.currency!==body.currencyCode)throw new ApiError('',502)
 return actual
}
