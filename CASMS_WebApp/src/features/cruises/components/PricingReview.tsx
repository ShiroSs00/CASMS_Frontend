import {useRef,useState} from 'react'
import {ApiError} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessCopy} from '@/shared/i18n/business-copy'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {Button,Field,Modal,Notice} from '@/shared/ui'
import {reviewPricing,type PricingAction} from '../api/pricing-review'
import type {PricingPolicy} from '../model/pricing-policy'
const keys={submit:'pricing.action.submit',approve:'pricing.action.approve',return:'pricing.action.return'} as const
export function PricingReview({policy,onSaved}:{policy:PricingPolicy;onSaved:()=>void}){
 const access=useSessionAccess(),[action,setAction]=useState<PricingAction|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false),lock=useRef(false)
 const ops=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_PRICING_APPROVE')
 async function execute(){
  if(!action||lock.current||unknown||action==='submit'||!ops)return
  lock.current=true;setBusy(true);setError('')
  try{await reviewPricing(policy,action,reason);setAction(null);onSaved()}
  catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''));if(!(e instanceof ApiError)||e.status===0||e.status>=500)setUnknown(true)}finally{lock.current=false;setBusy(false)}
 }
 const actions:PricingAction[]=policy.status==='PENDING_APPROVAL'&&ops?['approve','return']:[]
 return <>
  <p>{businessCopy('pricing.review.independent')}</p>{policy.decisionReason&&<Notice title={businessCopy('pricing.policy.RETURNED')}>{policy.decisionReason}</Notice>}
  {policy.status==='RETURNED'&&<p>Nếu kế hoạch đã được duyệt, chọn “Yêu cầu bổ sung” ở phần xét duyệt kế hoạch để CRM sửa giá và gửi lại.</p>}
  {actions.map(a=><Button key={a} disabled={busy||unknown||policy.revision==null||a!=='submit'&&policy.submittedBy===access.userId} onClick={()=>{setAction(a);setReason('')}}>{businessCopy(keys[a])}</Button>)}
  {error&&<Notice tone="error" title={businessCopy('pricing.review.failed')}>{error}</Notice>}
  {unknown&&<Notice title={businessCopy('pricing.review.unconfirmed')}>{businessCopy('pricing.review.reload')}</Notice>}
  {action&&<Modal title={businessCopy(keys[action])} onClose={()=>{if(!busy)setAction(null)}} footer={<Button disabled={busy||unknown||action==='return'&&!reason.trim()} onClick={()=>void execute()}>{businessCopy(keys[action])}</Button>}>
   <p>{policy.policyVersion} · {businessCopy('pricing.review.revision')}: {policy.revision}</p>
   {action==='return'&&<Field htmlFor="pricing-review-reason" label={businessCopy('pricing.review.reason')}><textarea id="pricing-review-reason" value={reason} onChange={e=>setReason(e.target.value)} required/></Field>}
  </Modal>}
 </>
}
