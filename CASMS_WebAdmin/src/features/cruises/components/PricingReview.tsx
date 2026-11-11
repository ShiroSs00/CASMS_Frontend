import {pricingCapabilities} from '../model/pricing-access'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import {useRef,useState} from 'react'
import {ApiError} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {businessCopy} from '@/shared/i18n/business-copy'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {Button,Field,Modal,Notice} from '@/shared/ui'
import {readPricingPolicy,reviewPricing,type PricingAction} from '../api/pricing-review'
import type {PricingPolicy} from '../model/pricing-policy'
import styles from './DeparturePricingPolicy.module.css'
import {pricingReviewCopy} from '../model/pricing-review-copy'
export function PricingReview({policy,onSaved,onReload,maker,reviewEvidenceReady}:{policy:PricingPolicy;onSaved:(message:string)=>void;onReload:()=>void;maker:boolean;reviewEvidenceReady:boolean}){
 const access=useSessionAccess(),[action,setAction]=useState<PricingAction|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[unknown,setUnknown]=useState(false),lock=useRef(false)
 const {draft:crm,review:ops}=pricingCapabilities(access)
 const copy=(value:PricingAction)=>pricingReviewCopy(policy.cruisePackagePricing===true,value)
 const actionLabel=(value:PricingAction)=>copy(value).label
 async function execute(){
  if(!action||lock.current||unknown||(action==='submit'?!crm:!ops)||policy.revision==null)return
  if(action==='submit'?policy.status!=='DRAFT':policy.status!=='PENDING_APPROVAL'||maker||!reviewEvidenceReady)return
  lock.current=true;setBusy(true);setError('')
  try{await reviewPricing(policy,action,reason);const message=copy(action).success;setAction(null);onSaved(message)}
  catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''));if(mutationOutcomeUnknown(e))setUnknown(true)}finally{lock.current=false;setBusy(false)}
 }
 async function recover(){
  if(lock.current||!unknown||(!crm&&!ops))return
  lock.current=true;setBusy(true)
  try{
   const actual=await readPricingPolicy(policy.cruiseId)
   const expected=action==='submit'?'PENDING_APPROVAL':action==='approve'?'APPROVED':action==='return'?'RETURNED':null
   setUnknown(false);setError('');setAction(null)
   if(expected&&actual.pricingPolicyId===policy.pricingPolicyId&&actual.revision===Number(policy.revision)+1&&actual.status===expected)onSaved(copy(action!).success)
   else onReload()
  }catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''))}
  finally{lock.current=false;setBusy(false)}
 }
 const actions:PricingAction[]=policy.status==='DRAFT'&&crm?['submit']:policy.status==='PENDING_APPROVAL'&&ops?['approve','return']:[]
 return <>
  <p className={styles.reviewHint}>{policy.cruisePackagePricing?'Duyệt thanh toán, hủy và phí độc lập với duyệt kế hoạch và giá Gói du thuyền.':'Duyệt giá là quyết định riêng với duyệt kế hoạch.'}</p>{policy.decisionReason&&<Notice title={businessCopy('pricing.policy.RETURNED')}>{policy.decisionReason}</Notice>}
  {policy.status==='RETURNED'&&<p>Quản lý lịch trình sửa và lưu bản nháp trước khi gửi chính sách để duyệt lại. Nếu kế hoạch đang khóa, cần yêu cầu bổ sung kế hoạch trước khi chỉnh sửa.</p>}
  {actions.length>0&&<div className={styles.reviewActions}>{actions.map(a=><Button key={a} tone={a==='approve'||a==='submit'?'primary':'secondary'} disabled={busy||unknown||policy.revision==null||(a!=='submit'&&(maker||!reviewEvidenceReady))} onClick={()=>{setAction(a);setReason('');setError('')}}>{actionLabel(a)}</Button>)}</div>}
  {policy.status==='PENDING_APPROVAL'&&maker&&<p className={styles.reviewHint}>Bạn đã cấu hình hoặc gửi bản chính sách này. Cần một tài khoản Quản lý vận hành khác xét duyệt.</p>}
  {policy.status==='PENDING_APPROVAL'&&!reviewEvidenceReady&&<p>Chưa đối chiếu đủ lịch sử người cấu hình. Tải lại chính sách và lịch sử trước khi xét duyệt.<Button tone="secondary" disabled={busy} onClick={onReload}>Tải lại chính sách và lịch sử</Button></p>}
  {error&&<Notice tone="error" title={copy(action??'approve').errorTitle}>{error}</Notice>}
  {unknown&&<Notice title={businessCopy('pricing.review.unconfirmed')}>Đọc lại trạng thái hiện tại trước khi thao tác tiếp. Không gửi lại yêu cầu đang chưa rõ kết quả.<Button disabled={busy} onClick={()=>void recover()}>Đối chiếu kết quả</Button></Notice>}
  {action&&<Modal busy={busy} title={actionLabel(action)} description={copy(action).description} onClose={()=>{if(!busy)setAction(null)}} footer={<><Button tone="secondary" disabled={busy} onClick={()=>setAction(null)}>Quay lại</Button><Button disabled={busy||unknown||action==='return'&&!reason.trim()} onClick={()=>void execute()}>{busy?'Đang lưu…':actionLabel(action)}</Button></>}>
   <p>{policy.policyVersion} · {businessCopy('pricing.review.revision')}: {policy.revision}</p>
   {action==='return'&&<Field htmlFor="pricing-review-reason" label={businessCopy('pricing.review.reason')}><textarea id="pricing-review-reason" value={reason} onChange={e=>setReason(e.target.value)} required/></Field>}
   {error&&<Notice tone="error" title={copy(action).errorTitle}>{error}</Notice>}
  </Modal>}
 </>
}

