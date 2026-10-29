import {ApiError,apiRequest} from '@/shared/api'
import {decodePricingPolicy,type PricingPolicy} from '../model/pricing-policy'
export type PricingAction='submit'|'approve'|'return'
export async function reviewPricing(policy:PricingPolicy,action:PricingAction,reason:string){
 if(policy.revision==null||!policy.pricingPolicyId)throw new ApiError('',409,'STALE_REVISION')
 const root=`/cruise/${encodeURIComponent(policy.cruiseId)}/pricing-policy`
 const saved=decodePricingPolicy(await apiRequest(`${root}/${action}`,{method:'POST',body:{expectedRevision:policy.revision,reason}}),policy.cruiseId)
 const actual=decodePricingPolicy(await apiRequest(root),policy.cruiseId)
 const expected=action==='submit'?'PENDING_APPROVAL':action==='approve'?'APPROVED':'RETURNED'
 if(saved.pricingPolicyId!==policy.pricingPolicyId||saved.status!==expected||saved.revision!==policy.revision+1||JSON.stringify(actual)!==JSON.stringify(saved))throw new ApiError('',502)
 return actual
}
