import {ApiError,apiRequest} from '@/shared/api'
import {decodePricingPolicy,samePricingPolicy,type PricingPolicy} from '../model/pricing-policy'
export type PricingAction='submit'|'approve'|'return'
export async function readPricingPolicy(cruiseId:string,signal?:AbortSignal):Promise<PricingPolicy>{
 return decodePricingPolicy(await apiRequest(`/cruise/${encodeURIComponent(cruiseId)}/pricing-policy`,{signal}),cruiseId)
}
export type PricingEvent={policyId:string;revision:number;action:string;actorId:string|null;reason:string|null;createdAt:string}
export async function readPricingHistory(cruiseId:string,signal?:AbortSignal):Promise<PricingEvent[]>{
 const rows=await apiRequest<unknown>(`/cruise/${encodeURIComponent(cruiseId)}/pricing-policy/history`,{signal})
 if(!Array.isArray(rows))throw new ApiError('Chưa đọc được lịch sử bản chính sách.',502)
 return rows.map(value=>{
  if(!value||typeof value!=='object')throw new ApiError('Lịch sử bản chính sách chưa hợp lệ.',502)
  const r=value as Record<string,unknown>,date=typeof r.created_at==='string'?Date.parse(r.created_at):typeof r.created_at==='number'?r.created_at:NaN
  if(typeof r.pricing_policy_id!=='string'||!Number.isSafeInteger(r.revision)||Number(r.revision)<0||typeof r.action!=='string'||!Number.isFinite(date)||!Number.isFinite(new Date(date).getTime())||r.actor_id!=null&&typeof r.actor_id!=='string'||r.reason!=null&&typeof r.reason!=='string')throw new ApiError('Lịch sử bản chính sách thiếu định danh, phiên dữ liệu hoặc thời điểm.',502)
  return{policyId:r.pricing_policy_id,revision:Number(r.revision),action:r.action,actorId:r.actor_id==null?null:r.actor_id as string,reason:r.reason==null?null:r.reason as string,createdAt:new Date(date).toISOString()}
 })
}
export async function reviewPricing(policy:PricingPolicy,action:PricingAction,reason:string){
 if(policy.revision==null||!policy.pricingPolicyId)throw new ApiError('',409,'STALE_REVISION')
 const root=`/cruise/${encodeURIComponent(policy.cruiseId)}/pricing-policy`
 const saved=decodePricingPolicy(await apiRequest(`${root}/${action}`,{method:'POST',body:{expectedRevision:policy.revision,reason}}),policy.cruiseId)
 const actual=decodePricingPolicy(await apiRequest(root),policy.cruiseId)
 const expected=action==='submit'?'PENDING_APPROVAL':action==='approve'?'APPROVED':'RETURNED'
 if(saved.pricingPolicyId!==policy.pricingPolicyId||saved.status!==expected||saved.revision!==policy.revision+1||!samePricingPolicy(saved,actual))throw new ApiError('',502)
 return actual
}

