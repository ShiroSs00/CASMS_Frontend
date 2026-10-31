import {useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Notice,Modal} from '@/shared/ui'
import {mainflowApi} from '../api/mainflow-api'
import {decodePricingPolicy,type PricingPolicy} from '../model/pricing-policy'
import styles from './PricingDraftFields.module.css'
const fields=[['interiorBaseFare','pricing.field.interior'],['oceanViewBaseFare','pricing.field.oceanView'],['balconyBaseFare','pricing.field.balcony'],['suiteBaseFare','pricing.field.suite'],['portFeePerPassenger','pricing.field.portFee'],['taxRate','pricing.field.taxRate'],['depositPercentage','pricing.field.deposit'],['finalPaymentDueDays','pricing.field.finalDays'],['fullPaymentCutoffDays','pricing.field.cutoffDays']] as const
export function PricingDraftFields({policy,cruiseId,onSaved}:{policy?:PricingPolicy;cruiseId:string;onSaved:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false),[uncertain,setUncertain]=useState(false),lock=useRef(false)
 const [open,setOpen]=useState(false),[errors,setErrors]=useState<Record<string,string>>({})
 const [currentPolicy,setCurrentPolicy]=useState<PricingPolicy|undefined>(policy)
 const [base,setBase]=useState<number|null>(null),[policyRevision,setPolicyRevision]=useState<number|null>(null)
 const [preparing,setPreparing]=useState(false),preparingLock=useRef(false)
 async function prepare(){if(preparingLock.current||busy||uncertain)return;preparingLock.current=true;setPreparing(true);setBase(null);setPolicyRevision(null);setCurrentPolicy(undefined);setError('');try{const view=await mainflowApi.get(cruiseId);if(!['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(view.planStatus))throw new ApiError('',409,'PLAN_FROZEN');let revision=0;try{const current=decodePricingPolicy(await apiRequest(`/cruise/${cruiseId}/pricing-policy`),cruiseId);if(current.revision==null||current.status==='PENDING_APPROVAL')throw new ApiError('',409,'PRICING_POLICY_PENDING');revision=current.revision;setCurrentPolicy(current)}catch(e){if(!(e instanceof ApiError)||e.status!==404)throw e}setPolicyRevision(revision);setBase(view.windows.expectedRevision)}catch(e){setError(businessErrorMessage(e instanceof ApiError?e.code:undefined,''))}finally{preparingLock.current=false;setPreparing(false)}}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current||uncertain||base==null||policyRevision==null)return
  const data=new FormData(e.currentTarget),body:Record<string,unknown>={currency:'USD',expectedRevision:policyRevision}
  const invalid:Record<string,string>={}
  for(const [key] of fields){const raw=String(data.get(key)??'').trim(),value=Number(raw);if(!raw)invalid[key]='Nhập giá trị cho trường này.';else if(!Number.isFinite(value)||value<0)invalid[key]='Nhập số lớn hơn hoặc bằng 0.';else if(['taxRate','depositPercentage'].includes(key)&&value>100)invalid[key]='Nhập tỷ lệ từ 0 đến 100%.';else if(key.endsWith('Days')&&!Number.isSafeInteger(value))invalid[key]='Nhập số ngày nguyên, lớn hơn hoặc bằng 0.'}
  setErrors(invalid)
  if(Object.keys(invalid).length){document.getElementById('pricing-'+Object.keys(invalid)[0])?.focus();return}
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
  <Button tone="secondary" disabled={busy||uncertain} onClick={()=>{setOpen(true);setError('');setErrors({});setSuccess(false);void prepare()}}>{policy?businessCopy('pricing.action.edit'):'Thiết lập chính sách giá'}</Button>
  {success&&<Notice title="Đã lưu chính sách giá" tone="success">{businessCopy('pricing.action.saved')}</Notice>}
  {open&&<Modal wide busy={busy||preparing} title={policy?businessCopy('pricing.action.edit'):'Thiết lập chính sách giá'} description="Giá mới được lưu bằng USD. Lưu bản nháp trước khi gửi hồ sơ chuyến khởi hành." onClose={()=>setOpen(false)} footer={<><Button tone="secondary" disabled={busy||preparing} data-overlay-dismiss onClick={()=>setOpen(false)}>Hủy</Button><Button type="submit" form="pricing-draft-form" disabled={busy||preparing||uncertain||base==null}>{busy?'Đang lưu…':businessCopy('pricing.action.saveDraft')}</Button></>}>
  {preparing&&<p role="status">Đang tải chính sách giá…</p>}
  {!preparing&&base==null&&!uncertain&&<Button tone="secondary" onClick={()=>void prepare()}>Thử lại</Button>}
  {!preparing&&base!=null&&<form key={`${base}:${policyRevision}`} id="pricing-draft-form" className={styles.form} noValidate onSubmit={e=>void save(e)}>
   <fieldset disabled={busy||uncertain} className={styles.fields}>
    {(['Giá cabin và phí cảng','Thuế và đặt cọc','Thời hạn thanh toán'] as const).map((title,index)=><section className={styles.group} key={title} aria-label={title}>
     <h3>{title}</h3>
     {index===0&&<p className={styles.hint}>Tất cả số tiền bên dưới dùng USD.</p>}
     <div className={styles.grid}>{fields.slice(index===0?0:index===1?5:7,index===0?5:index===1?7:9).map(([key,label])=>{
      const percent=['taxRate','depositPercentage'].includes(key),days=key.endsWith('Days'),unit=percent?'%':days?'ngày':'USD'
      const hints:Record<string,string>={taxRate:'Nhập 10 nghĩa là thuế 10%.',depositPercentage:'Nhập 30 nghĩa là đặt cọc 30%.',finalPaymentDueDays:'Số ngày trước khởi hành phải thanh toán hết phần còn lại.',fullPaymentCutoffDays:'Đặt trong khoảng này trước khởi hành thì phải trả đủ ngay.'}
      const labels:Record<string,string>={taxRate:'Thuế suất',depositPercentage:'Tỷ lệ đặt cọc',finalPaymentDueDays:'Hạn trả phần còn lại',fullPaymentCutoffDays:'Đặt sát ngày phải trả đủ'}
      return <Field key={key} htmlFor={'pricing-'+key} label={labels[key]??businessCopy(label)} error={errors[key]} hint={hints[key]}>
       <div className={styles.inputUnit}><input id={'pricing-'+key} name={key} aria-label={`${labels[key]??businessCopy(label)} (${unit})`} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]||hints[key]?'pricing-'+key+'-hint':undefined} defaultValue={(key.endsWith('BaseFare')||key==='portFeePerPassenger')&&currentPolicy?.currency!=='USD'?'':percent&&currentPolicy?.[key]!=null?Number((Number(currentPolicy[key])*100).toFixed(8)):currentPolicy?.[key]??''} required type="number" min={0} step={days?'1':percent?'0.01':'any'} max={percent?100:undefined} onChange={()=>{if(errors[key])setErrors(previous=>{const next={...previous};delete next[key];return next})}}/><span aria-hidden="true">{unit}</span></div>
      </Field>
     })}</div>
    </section>)}
    <section className={styles.group} aria-label="Hủy đặt chỗ và hoàn tiền"><h3>Hủy đặt chỗ và hoàn tiền</h3>
     <Field htmlFor="pricing-cancellationPolicy" label="Nội dung chính sách hủy" hint="Nêu rõ thời hạn hủy, phí hủy và điều kiện hoàn tiền."><textarea id="pricing-cancellationPolicy" name="cancellationPolicy" rows={4} defaultValue={currentPolicy?.cancellationPolicy??''}/></Field>
    </section>
   </fieldset>
  </form>}
  {error&&<Notice title="Chưa lưu được chính sách giá" tone="error">{error}</Notice>}
  {uncertain&&<Notice title="Hệ thống chưa xác nhận được kết quả">Tải lại trang để đối chiếu trước khi gửi tiếp.</Notice>}
 </Modal>}
 </>
}
