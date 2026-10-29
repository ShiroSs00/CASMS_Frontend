import {useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Notice} from '@/shared/ui'
import {mainflowApi} from '../api/mainflow-api'
import {decodePricingPolicy,type PricingPolicy} from '../model/pricing-policy'
const fields=[['interiorBaseFare','pricing.field.interior'],['oceanViewBaseFare','pricing.field.oceanView'],['balconyBaseFare','pricing.field.balcony'],['suiteBaseFare','pricing.field.suite'],['portFeePerPassenger','pricing.field.portFee'],['taxRate','pricing.field.taxRate'],['depositPercentage','pricing.field.deposit'],['finalPaymentDueDays','pricing.field.finalDays'],['fullPaymentCutoffDays','pricing.field.cutoffDays']] as const
export function PricingDraftFields({policy,cruiseId,onSaved}:{policy?:PricingPolicy;cruiseId:string;onSaved:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const [base,setBase]=useState<number|null>(null),[policyRevision,setPolicyRevision]=useState<number|null>(null)
 async function prepare(){try{const view=await mainflowApi.get(cruiseId);if(!['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(view.planStatus))throw new ApiError('',409,'PLAN_FROZEN');let revision=0;try{const current=decodePricingPolicy(await apiRequest(`/cruise/${cruiseId}/pricing-policy`),cruiseId);if(current.revision==null||current.status==='PENDING_APPROVAL')throw new ApiError('',409,'PRICING_POLICY_PENDING');revision=current.revision}catch(e){if(!(e instanceof ApiError)||e.status!==404)throw e}setPolicyRevision(revision);setBase(view.windows.expectedRevision)}catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''))}}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current||uncertain||base==null||policyRevision==null)return
  const data=new FormData(e.currentTarget),body:Record<string,unknown>={currency:'USD',expectedRevision:policyRevision}
  for(const [key] of fields){const raw=String(data.get(key)??'').trim();body[key]=raw===''?null:Number(raw)}
  body.cancellationPolicy=String(data.get('cancellationPolicy')??'')
  lock.current=true;setBusy(true);setError('');setSuccess(false)
  try{
   const saved=decodePricingPolicy(await apiRequest(`/cruise-plans/${cruiseId}/pricing-policy`,{method:'PUT',ifMatch:base,body}),cruiseId)
   const actual=decodePricingPolicy(await apiRequest(`/cruise/${cruiseId}/pricing-policy`),cruiseId)
   if(saved.status!=='DRAFT'||saved.currency!=='USD'||saved.revision!==policyRevision+1||!saved.pricingPolicyId||JSON.stringify(saved)!==JSON.stringify(actual)||fields.some(([key])=>actual[key]!==body[key]))throw new ApiError('',502)
   setSuccess(true);setBase(null);onSaved()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <details><summary>{businessCopy('pricing.action.edit')}</summary><p>{businessCopy('pricing.review.usd')}</p>
  <Button disabled={busy} onClick={()=>void prepare()}>{businessCopy('pricing.action.loadRevision')}</Button>
  <form onSubmit={e=>void save(e)}><fieldset disabled={busy||uncertain||base==null}>
   {fields.map(([key,label])=><Field key={key} htmlFor={'pricing-'+key} label={businessCopy(label)}><input id={'pricing-'+key} name={key} defaultValue={(key.endsWith('BaseFare')||key==='portFeePerPassenger')&&policy?.currency!=='USD'?'':policy?.[key]??''} required type="number" min={0} step={key.endsWith('Days')?'1':'any'} max={['taxRate','depositPercentage'].includes(key)?1:undefined}/></Field>)}
   <Field htmlFor="pricing-cancellationPolicy" label={businessCopy('pricing.field.cancellation')}><textarea id="pricing-cancellationPolicy" name="cancellationPolicy" defaultValue={policy?.cancellationPolicy??''}/></Field>
   <Button type="submit">{businessCopy('pricing.action.saveDraft')}</Button></fieldset>
  </form>{error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{success&&<Notice title={businessCopy('pricing.policy.DRAFT')}>{businessCopy('pricing.action.saved')}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
 </details>
}
