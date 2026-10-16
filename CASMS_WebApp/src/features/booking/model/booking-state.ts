import { useEffect, useRef, useState } from 'react'
import type { ActionResult, MissingCapability } from './booking-types'
import { bookingApi } from '../api/booking-api'
export function useBookingAction() {
 const [result,setResult]=useState<ActionResult|null>(null)
 const [pending,setPending]=useState(false)
 const lock=useRef(false)
 const mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 async function run(capability:MissingCapability,input?:unknown) {
  if(lock.current)return
  lock.current=true;setPending(true);setResult(null)
  try { const next=await bookingApi.perform(capability,input);if(mounted.current)setResult(next) }
  catch { if(mounted.current)setResult({state:'unknown',message:'Chưa xác định được kết quả. Kiểm tra trạng thái trước khi gửi lại.'}) }
  finally {lock.current=false;if(mounted.current)setPending(false)}
 }
 return {result,pending,run}
}
export function useAdapterData<T>(load:(signal:AbortSignal)=>Promise<T>) {
 const [state,setState]=useState<{data?:T;error?:string;loading:boolean}>({loading:true})
 const [attempt,setAttempt]=useState(0)
 useEffect(()=>{const controller=new AbortController();load(controller.signal).then(data=>{if(!controller.signal.aborted)setState({data,loading:false})}).catch(()=>{if(!controller.signal.aborted)setState({error:'Không tải được dữ liệu. Vui lòng thử lại.',loading:false})});return()=>controller.abort()},[load,attempt])
 return {...state,retry:()=>{setState({loading:true});setAttempt(n=>n+1)}}
}

