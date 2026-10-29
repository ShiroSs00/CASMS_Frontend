import {useEffect,useRef,useState,type FormEvent} from 'react'
import {ApiError} from '@/shared/api'
import {businessErrorMessage} from '@/shared/api/business-errors'
import {businessCopy} from '@/shared/i18n/business-copy'
import {Button,Field,Notice} from '@/shared/ui'
import {activityCapacityConflict,activityScheduleConflict,updateScopedActivity,type ScopedActivity,type ActivityInput} from '../api/scoped-activity'
import {SHIP_TIME_ZONE,zonedInput,wallTimeToInstant} from '@/shared/lib/journey-time'
import {CruiseDeckField,type CruiseVenueOptions} from './CruiseDeckField'

const shipTime=(value:string)=>zonedInput(value,SHIP_TIME_ZONE)
export function CruiseActivityEditor({activity,venueOptions,revision,fixed,onSaved,onClose}:{activity:ScopedActivity;venueOptions:CruiseVenueOptions;revision:number;fixed:boolean;onSaved:()=>void;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[allocated,setAllocated]=useState<number|null>(null),lock=useRef(false),capacityField=useRef<HTMLInputElement>(null)
 const [scheduleField,setScheduleField]=useState<'startTime'|'endTime'|null>(null),startField=useRef<HTMLInputElement>(null),endField=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(busy)return;if(allocated!==null)capacityField.current?.focus();else if(scheduleField==='startTime')startField.current?.focus();else if(scheduleField==='endTime')endField.current?.focus()},[allocated,busy,scheduleField])
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||uncertain)return
  const form=new FormData(event.currentTarget),text=(key:string)=>String(form.get(key)??'').trim()
  let start=activity.startTime,end=activity.endTime
  if(!fixed)try{start=wallTimeToInstant(text('start'),SHIP_TIME_ZONE);end=wallTimeToInstant(text('end'),SHIP_TIME_ZONE)}catch{setError(businessCopy('program.time.invalid'));return}
  // FIXED retains exact source fields, including seconds, null description and location IDs.
  const deckId=fixed||activity.cabinId?activity.deckId:text('deckId')||null
  const body:ActivityInput={cruiseId:activity.cruiseId,activityName:fixed?activity.name:text('name'),description:fixed?activity.description:text('description'),location:fixed?activity.location:text('location'),startTime:start,endTime:end,deckId,cabinId:activity.cabinId,capacity:Number(text('capacity')),price:Number(text('price')),currencyCode:'USD'}
  lock.current=true;setBusy(true);setError('');setAllocated(null);setScheduleField(null)
  try{await updateScopedActivity(activity.cruiseId,activity.id,revision,body);onSaved()}
  catch(reason){setError(businessErrorMessage(reason instanceof ApiError?reason.code:undefined,''));setAllocated(activityCapacityConflict(reason));setScheduleField(activityScheduleConflict(reason));if(!(reason instanceof ApiError)||reason.status===0||reason.status>=500)setUncertain(true)}
  finally{lock.current=false;setBusy(false)}
 }
 return <form onSubmit={save} aria-label={businessCopy('program.activity.edit')}>
  {fixed&&<Notice title={businessCopy('cruise.itinerary.FIXED')}>{businessCopy('program.activity.fixedEdit')}</Notice>}
  <fieldset disabled={busy||uncertain}>
   <Field htmlFor="activity-edit-name" label={businessCopy('program.field.name')}><input id="activity-edit-name" name="name" defaultValue={activity.name} disabled={fixed} required/></Field>
   <Field htmlFor="activity-edit-description" label={businessCopy('program.field.description')}><textarea id="activity-edit-description" name="description" defaultValue={activity.description??''} disabled={fixed}/></Field>
   <CruiseDeckField options={venueOptions} value={activity.deckId} disabled={fixed||Boolean(activity.cabinId)}/>
   <Field htmlFor="activity-edit-location" label={businessCopy('program.field.location')}><input id="activity-edit-location" name="location" defaultValue={activity.location} disabled={fixed} required/></Field>
   <Field htmlFor="activity-edit-start" label={businessCopy('program.field.startShip')} error={scheduleField==='startTime'?businessErrorMessage('ACTIVITY_OUTSIDE_CRUISE',''):undefined}><input ref={startField} id="activity-edit-start" name="start" type="datetime-local" step={1} defaultValue={shipTime(activity.startTime)} disabled={fixed} required/></Field>
   <Field htmlFor="activity-edit-end" label={businessCopy('program.field.endShip')} error={scheduleField==='endTime'?businessErrorMessage('ACTIVITY_OUTSIDE_CRUISE',''):undefined}><input ref={endField} id="activity-edit-end" name="end" type="datetime-local" step={1} defaultValue={shipTime(activity.endTime)} disabled={fixed} required/></Field>
   <Field htmlFor="activity-edit-capacity" label={businessCopy('program.field.capacity')} error={allocated===null?undefined:businessCopy('program.activity.capacityAllocated')+': '+allocated}><input ref={capacityField} id="activity-edit-capacity" name="capacity" type="number" min={1} step={1} defaultValue={activity.capacity??''} required/></Field>
   <Field htmlFor="activity-edit-price" label={businessCopy('program.field.priceUsd')}><input id="activity-edit-price" name="price" type="number" min={0} step="any" defaultValue={activity.currencyCode==='USD'?activity.price??'':''} required/></Field>
   <Button type="submit">{businessCopy('program.action.saveDraft')}</Button>
  </fieldset>
  <Button disabled={busy} onClick={onClose}>{businessCopy('program.activity.closeEdit')}</Button>
  {error&&<Notice title={businessCopy('program.activity.saveFailed')} tone="error">{error}</Notice>}
  {uncertain&&<Notice title={businessCopy('program.activity.unconfirmed')}>{businessCopy('program.activity.reloadBeforeRetry')}</Notice>}
 </form>
}
