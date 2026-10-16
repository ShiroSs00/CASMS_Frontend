import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { BookingContext } from '../model/booking-context'
import { initialDraft } from '../model/booking-draft'
import { defaultScenario } from '../model/booking-scenarios'
import { BookingDemoTools } from './BookingDemoTools'
export function BookingProvider() {
 const [draft,setDraft]=useState(initialDraft)
 const [scenario,setScenario]=useState(defaultScenario)
 const hasInput=Boolean(draft.cruiseId&&draft.travellers.some(t=>t.name||t.birthDate||t.email||t.phone))
 useEffect(()=>{
  if(!hasInput)return
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
  window.addEventListener('beforeunload',warn)
  return()=>window.removeEventListener('beforeunload',warn)
 },[hasInput])
 return <BookingContext.Provider value={{draft,setDraft,scenario,setScenario}}><Outlet/><BookingDemoTools/></BookingContext.Provider>
}

