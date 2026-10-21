import { useEffect, useRef, useState } from 'react'
import type { ActionResult, MissingCapability } from './booking-types'
import { bookingApi } from '../api/booking-preview-api'
import { useBookingDraft } from './booking-context'
export function useBookingAction() {
 const {scenario}=useBookingDraft()
 const [result,setResult]=useState<ActionResult|null>(null)
 const [pending,setPending]=useState(false)
 const lock=useRef(false)
 const mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 async function run(capability:MissingCapability,input?:unknown) {
  if(lock.current)return
  lock.current=true;setPending(true);setResult(null)
  try { const next=await bookingApi.perform(capability,input,scenario.action);if(mounted.current)setResult(next) }
  catch { if(mounted.current)setResult({state:'unknown',message:'Chưa xác định được kết quả. Kiểm tra trạng thái trước khi gửi lại.'}) }
  finally {lock.current=false;if(mounted.current)setPending(false)}
 }
 return {result,pending,run}
}
