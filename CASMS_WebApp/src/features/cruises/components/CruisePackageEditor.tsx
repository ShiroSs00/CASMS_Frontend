import {useCallback,useRef,useState,type FormEvent} from 'react'
import {ApiError,apiRequest,useReadQuery} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
import {Button,Field,Loading,Notice,Modal} from '@/shared/ui'
import {mainflowApi} from '../api/mainflow-api'
import {addScopedPackageComponent,packageComponents,updateScopedPackage,type ComponentKind,type ScopedPackage,type PackageComponent} from '../api/scoped-package'
import type {ScopedActivity} from '../api/scoped-activity'
import styles from './ManagerWorkspace.module.css'
type Choice={id:string;name:string}
type Workspace={pkg:ScopedPackage;revision:number;editable:boolean;components:PackageComponent[];choices:Record<ComponentKind,Choice[]>}
export function CruisePackageEditor({cruiseId,packageId,onSaved,onClose}:{cruiseId:string;packageId:string;onSaved:()=>void;onClose:()=>void}){
 const query=useReadQuery(`package-workspace:${cruiseId}:${packageId}`,useCallback(async signal=>{
  const root=`/cruise-plans/${cruiseId}`
  const [plan,rows,components,options,activities,excursions]=await Promise.all([mainflowApi.get(cruiseId,signal),apiRequest<ScopedPackage[]>(root+'/packages',{signal}),packageComponents(cruiseId,packageId,signal),apiRequest<{services:Choice[]}>(root+'/program-options',{signal}),apiRequest<ScopedActivity[]>(root+'/activities',{signal}),apiRequest<Choice[]>(root+'/excursions',{signal})])
  const pkg=rows.find(p=>p.id===packageId);if(!pkg||pkg.ownerCruiseId!==cruiseId)throw new ApiError('',403,'CROSS_CRUISE_ACCESS')
  return {pkg,revision:plan.windows.expectedRevision,editable:['DRAFT','WITHDRAWN','REVISION_REQUESTED'].includes(plan.planStatus),components,choices:{services:options.services,activities:activities.map(a=>({id:a.id,name:a.name})),excursions}}
 },[cruiseId,packageId]))
 if(query.data)return <PackageForms key={packageId} cruiseId={cruiseId} initial={query.data} onSaved={onSaved} onClose={onClose}/>
 return <Modal wide protectChanges={false} title={businessCopy('program.package.edit')} onClose={onClose} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
  {query.loading&&<Loading/>}{query.error&&<Notice title={businessCopy('program.package.loadFailed')}><Button onClick={query.retry}>{businessCopy('program.package.retry')}</Button></Notice>}
 </Modal>
}
function PackageForms({cruiseId,initial,onSaved,onClose}:{cruiseId:string;initial:Workspace;onSaved:()=>void;onClose:()=>void}){
 // Capture the loaded revision with the form; a later query response cannot renew a stale edit.
 const [base]=useState(initial),[mode,setMode]=useState<'details'|'components'>('details'),[kind,setKind]=useState<ComponentKind>('services'),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),lock=useRef(false)
 const locked=!base.editable||busy||uncertain
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||locked)return
  const f=new FormData(event.currentTarget),value=(key:string)=>String(f.get(key)??'').trim()
  lock.current=true;setBusy(true);setError('')
  try{
   if(mode==='details')await updateScopedPackage(cruiseId,base.pkg,base.revision,{name:value('name'),description:value('description'),price:Number(value('price')),currency:'USD'})
   else await addScopedPackageComponent(cruiseId,base.pkg.id,base.revision,{kind,referenceId:value('referenceId'),benefitType:value('benefitType') as 'INCLUDED'|'OPTIONAL'})
   onSaved()
  }catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <Modal wide busy={busy} title={businessCopy('program.package.edit')} onClose={onClose} footer={<><Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={onClose}>Hủy</Button><Button type="submit" form="package-edit-form" disabled={locked}>{busy?'Đang lưu…':businessCopy(mode==='details'?'program.action.saveDraft':'program.package.addComponent')}</Button></>}>
  <h3>{base.pkg.name}</h3><ul>{base.components.map(c=><li key={c.kind+':'+c.referenceId}>{c.name} · {domainStatus('program.package.benefit',c.benefitType)}</li>)}</ul>
  {!base.editable&&<Notice title={businessCopy('program.locked')}>{businessErrorMessage('PLAN_FROZEN','')}</Notice>}
  <Field htmlFor="package-edit-mode" label={businessCopy('program.package.operation')}><select id="package-edit-mode" value={mode} disabled={locked} onChange={e=>setMode(e.target.value as 'details'|'components')}><option value="details">{businessCopy('program.package.details')}</option><option value="components">{businessCopy('program.package.addComponent')}</option></select></Field>
  <form id="package-edit-form" className={styles.modalForm} key={mode} onSubmit={save}><fieldset disabled={locked}>
   {mode==='details'?<>
    <Field htmlFor="package-edit-name" label={businessCopy('program.field.name')}><input id="package-edit-name" name="name" defaultValue={base.pkg.name} required/></Field>
    <Field htmlFor="package-edit-description" label={businessCopy('program.field.description')}><textarea id="package-edit-description" name="description" defaultValue={base.pkg.description??''}/></Field>
    <Field htmlFor="package-edit-price" label={businessCopy('program.field.priceUsd')}><input id="package-edit-price" name="price" type="number" min={0} step="any" defaultValue={base.pkg.currency==='USD'?base.pkg.price:''} required/></Field>
   </>:<>
    <Field htmlFor="package-component-kind" label={businessCopy('program.package.componentKind')}><select id="package-component-kind" value={kind} onChange={e=>setKind(e.target.value as ComponentKind)}><option value="services">{businessCopy('program.package.kind.services')}</option><option value="activities">{businessCopy('program.onboardActivity')}</option><option value="excursions">{businessCopy('program.SHORE_EXCURSION')}</option></select></Field>
    <Field htmlFor="package-component-reference" label={businessCopy('program.package.component')}><select key={kind} id="package-component-reference" name="referenceId" required><option value="">{businessCopy('program.package.chooseComponent')}</option>{base.choices[kind].filter(c=>!base.components.some(p=>p.kind===kind&&p.referenceId===c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <Field htmlFor="package-component-benefit" label={businessCopy('program.package.benefitType')}><select id="package-component-benefit" name="benefitType" required><option value="">{businessCopy('program.package.chooseBenefit')}</option><option value="INCLUDED">{businessCopy('program.package.benefit.INCLUDED')}</option><option value="OPTIONAL">{businessCopy('program.package.benefit.OPTIONAL')}</option></select></Field>
   </>}

  </fieldset></form>
  {error&&<Notice title={businessCopy('program.package.saveFailed')} tone="error">{error}</Notice>}
  {uncertain&&<Notice title={businessCopy('program.package.unconfirmed')}>{businessCopy('program.package.reloadBeforeRetry')}</Notice>}
 </Modal>
}
