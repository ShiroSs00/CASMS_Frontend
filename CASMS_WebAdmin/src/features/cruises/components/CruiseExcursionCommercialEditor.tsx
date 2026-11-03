import {useEffect,useRef,useState,type FormEvent} from 'react'
import {ApiError} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Notice,Modal} from '@/shared/ui'
import styles from './ManagerWorkspace.module.css'
import {excursionCapacityConflict,updateExcursionCommercial,type ExcursionCommercial} from '../api/scoped-excursion'
export function CruiseExcursionCommercialEditor({cruiseId,entry,revision,onSaved,onClose}:{cruiseId:string;entry:ExcursionCommercial;revision:number;onSaved:()=>void;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[allocated,setAllocated]=useState<number|null>(null),lock=useRef(false),capacity=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(!busy&&allocated!==null)capacity.current?.focus()},[busy,allocated])
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||uncertain)return
  const f=new FormData(event.currentTarget),body={maximumCapacity:Number(f.get('capacity')),price:Number(f.get('price')),currencyCode:'USD'}
  lock.current=true;setBusy(true);setError('');setAllocated(null)
  try{await updateExcursionCommercial(cruiseId,entry.id,revision,body);onSaved()}
  catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));setAllocated(excursionCapacityConflict(reason));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}finally{lock.current=false;setBusy(false)}
 }
 return <Modal wide busy={busy} title={businessCopy('program.excursion.editCommercial')} onClose={onClose} footer={<><Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={onClose}>Hủy</Button><Button type="submit" form="excursion-commercial-form" disabled={busy||uncertain}>{busy?'Đang lưu…':businessCopy('program.excursion.saveCommercial')}</Button></>}><form id="excursion-commercial-form" className={styles.modalForm} onSubmit={save} aria-label={businessCopy('program.excursion.editCommercial')}>
  <h3>{entry.name}</h3><p>{businessCopy('program.excursion.preserveStructure')}</p>
  <fieldset disabled={busy||uncertain}>
   <Field htmlFor="excursion-commercial-capacity" label={businessCopy('program.field.capacity')} error={allocated===null?undefined:businessCopy('program.excursion.capacityAllocated')+': '+allocated}><input ref={capacity} id="excursion-commercial-capacity" name="capacity" type="number" min={1} step={1} defaultValue={entry.capacity} required/></Field>
   <Field htmlFor="excursion-commercial-price" label={businessCopy('program.field.priceUsd')}><input id="excursion-commercial-price" name="price" type="number" min={0} step="any" defaultValue={entry.currency==='USD'?entry.price??'':''} required/></Field>

  </fieldset>

  {error&&<Notice title={businessCopy('program.excursion.saveFailed')} tone="error">{error}</Notice>}
  {uncertain&&<Notice title={businessCopy('program.excursion.unconfirmed')}>{businessCopy('program.excursion.reloadBeforeRetry')}</Notice>}
 </form></Modal>
}
