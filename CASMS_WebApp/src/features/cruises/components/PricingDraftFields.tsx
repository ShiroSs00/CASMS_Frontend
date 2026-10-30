import {useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Notice,Modal} from '@/shared/ui'
import {mainflowApi} from '../api/mainflow-api'
import {decodePricingPolicy,type PricingPolicy} from '../model/pricing-policy'
import styles from './ManagerWorkspace.module.css'
const fields=[['interiorBaseFare','pricing.field.interior'],['oceanViewBaseFare','pricing.field.oceanView'],['balconyBaseFare','pricing.field.balcony'],['suiteBaseFare','pricing.field.suite'],['portFeePerPassenger','pricing.field.portFee'],['taxRate','pricing.field.taxRate'],['depositPercentage','pricing.field.deposit'],['finalPaymentDueDays','pricing.field.finalDays'],['fullPaymentCutoffDays','pricing.field.cutoffDays']] as const
export function PricingDraftFields({policy,cruiseId,onSaved}:{policy?:PricingPolicy;cruiseId:string;onSaved:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const [open,setOpen]=useState(false)
 const [currentPolicy,setCurrentPolicy]=useState<PricingPolicy|undefined>(policy)
 const [base,setBase]=useState<number|null>(null),[policyRevision,setPolicyRevision]=useState<number|null>(null)
 const [preparing,setPreparing]=useState(false),preparingLock=useRef(false)
 async function prepare(){if(preparingLock.current||busy||uncertain)return;preparingLock.current=true;setPreparing(true);setBase(null);setPolicyRevision(null);setCurrentPolicy(undefined);setError('');try{const view=await mainflowApi.get(cruiseId);if(!['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(view.planStatus))throw new ApiError('',409,'PLAN_FROZEN');let revision=0;try{const current=decodePricingPolicy(await apiRequest(`/cruise/${cruiseId}/pricing-policy`),cruiseId);if(current.revision==null||current.status==='PENDING_APPROVAL')throw new ApiError('',409,'PRICING_POLICY_PENDING');revision=current.revision;setCurrentPolicy(current)}catch(e){if(!(e instanceof ApiError)||e.status!==404)throw e}setPolicyRevision(revision);setBase(view.windows.expectedRevision)}catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''))}finally{preparingLock.current=false;setPreparing(false)}}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current||uncertain||base==null||policyRevision==null)return
  const data=new FormData(e.currentTarget),body:Record<string,unknown>={currency:'USD',expectedRevision:policyRevision}
  for(const [key] of fields){const raw=String(data.get(key)??'').trim();body[key]=raw===''?null:['taxRate','depositPercentage'].includes(key)?Number((Number(raw)/100).toFixed(4)):Number(raw)}
  body.cancellationPolicy=String(data.get('cancellationPolicy')??'')
  lock.current=true;setBusy(true);setError('');setSuccess(false)
  try{
   const saved=decodePricingPolicy(await apiRequest(`/cruise-plans/${cruiseId}/pricing-policy`,{method:'PUT',ifMatch:base,body}),cruiseId)
   const actual=decodePricingPolicy(await apiRequest(`/cruise/${cruiseId}/pricing-policy`),cruiseId)
   if(saved.status!=='DRAFT'||saved.currency!=='USD'||saved.revision!==policyRevision+1||!saved.pricingPolicyId||JSON.stringify(saved)!==JSON.stringify(actual)||fields.some(([key])=>actual[key]!==body[key]))throw new ApiError('',502)
   setSuccess(true);setBase(null);setOpen(false);onSaved()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <>
  <Button tone="secondary" disabled={busy||uncertain} onClick={()=>{setOpen(true);setError('');setSuccess(false);void prepare()}}>{policy?businessCopy('pricing.action.edit'):'Thiết lập chính sách giá'}</Button>
  {success&&<Notice title="Đã lưu chính sách giá" tone="success">{businessCopy('pricing.action.saved')}</Notice>}
  {open&&<Modal wide busy={busy||preparing} title={policy?businessCopy('pricing.action.edit'):'Thiết lập chính sách giá'} description={businessCopy('pricing.review.usd')} onClose={()=>setOpen(false)} footer={<><Button tone="secondary" disabled={busy||preparing} data-overlay-dismiss onClick={()=>setOpen(false)}>Hủy</Button><Button type="submit" form="pricing-draft-form" disabled={busy||preparing||uncertain||base==null}>{busy?'Đang lưu…':businessCopy('pricing.action.saveDraft')}</Button></>}>
  {preparing&&<p role="status">Đang tải chính sách giá…</p>}
  {!preparing&&base==null&&!uncertain&&<Button tone="secondary" onClick={()=>void prepare()}>Thử lại</Button>}
  <form key={base==null?'loading':`${base}:${policyRevision}`} id="pricing-draft-form" onSubmit={e=>void save(e)}><fieldset disabled={busy||preparing||uncertain||base==null} className={styles.formGroup}><legend>Giá và điều kiện thanh toán</legend>
   {(['Giá cabin và phí cảng (USD)','Thuế và đặt cọc (%)','Thời hạn thanh toán (ngày)'] as const).map((title,index)=><fieldset className={styles.formGroup} key={title}><legend>{title}</legend><div className={styles.fieldGrid}>{fields.slice(index===0?0:index===1?5:7,index===0?5:index===1?7:9).map(([key,label])=><Field key={key} htmlFor={'pricing-'+key} label={key==='taxRate'?'Thuế suất (%)':key==='depositPercentage'?'Tỷ lệ đặt cọc (%)':key==='fullPaymentCutoffDays'?'Bắt buộc trả đủ khi đặt sát ngày khởi hành (ngày)':key==='finalPaymentDueDays'?'Hạn thanh toán phần còn lại (ngày trước khởi hành)':businessCopy(label)}><input id={'pricing-'+key} name={key} defaultValue={(key.endsWith('BaseFare')||key==='portFeePerPassenger')&&currentPolicy?.currency!=='USD'?'':['taxRate','depositPercentage'].includes(key)&&currentPolicy?.[key]!=null?Number((Number(currentPolicy[key])*100).toFixed(8)):currentPolicy?.[key]??''} required type="number" min={0} step={key.endsWith('Days')?'1':['taxRate','depositPercentage'].includes(key)?'0.01':'any'} max={['taxRate','depositPercentage'].includes(key)?100:undefined}/></Field>)}</div></fieldset>)}
   <Field htmlFor="pricing-cancellationPolicy" label={businessCopy('pricing.field.cancellation')} hint="Mô tả thời hạn hủy đặt chỗ, phí hủy và điều kiện hoàn tiền."><textarea id="pricing-cancellationPolicy" name="cancellationPolicy" rows={5} defaultValue={currentPolicy?.cancellationPolicy??''}/></Field>
   </fieldset>
  </form>{error&&<Notice title="Không thể hoàn tất thao tác" tone="error">{error}</Notice>}{success&&<Notice title={businessCopy('pricing.policy.DRAFT')}>{businessCopy('pricing.action.saved')}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
 </Modal>}
 </>
}
