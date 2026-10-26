import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import { Button, Modal } from '@/shared/ui'
import { Context } from './planning-context'
import { failure } from './api/live'
import type { PlanningGateway } from './api/gateway'
import { sourceQueryKey } from './model/source-query'
export function usePlanning(){const value=useContext(Context);if(!value)throw new Error('Planning provider missing');return value}
export function useUnsavedGuard(dirty:boolean,busy=false) {
  const {unsavedRef}=usePlanning(),allowed=useRef(false)
  useEffect(()=>{unsavedRef.current=dirty||busy;const warn=(event:BeforeUnloadEvent)=>{if(dirty||busy){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>{unsavedRef.current=false;window.removeEventListener('beforeunload',warn)}},[dirty,busy,unsavedRef])
  const blocker=useBlocker(({currentLocation,nextLocation})=>(dirty||busy)&&!allowed.current&&(currentLocation.pathname!==nextLocation.pathname||new URLSearchParams(currentLocation.search).get('versionId')!==new URLSearchParams(nextLocation.search).get('versionId')))
  const prompt=blocker.state==='blocked'?<Modal title={busy?'Đang xử lý yêu cầu':'Bản nháp chưa được lưu'} onClose={()=>blocker.reset()} footer={<><Button tone="secondary" onClick={()=>blocker.reset()}>Ở lại</Button><Button tone="danger" disabled={busy} onClick={()=>blocker.proceed()}>Bỏ thay đổi và rời trang</Button></>}>{busy?<p>Chờ yêu cầu hiện tại hoàn tất để xác định dữ liệu đã lưu trước khi rời trang.</p>:<p>Những thay đổi chưa lưu trên màn hình sẽ bị bỏ. Dữ liệu này không được khôi phục sau khi đóng trình duyệt.</p>}</Modal>:null
  return {prompt,allowLeave:()=>{allowed.current=true;unsavedRef.current=false}}
}
export function useSources(kind:Parameters<PlanningGateway['sources']>[0],query:Parameters<PlanningGateway['sources']>[2]={},enabled=true,revision?:number) {
  const {gateway}=usePlanning(),[attempt,setAttempt]=useState(0)
  const {keyword='',category='',portId='',destinationId='',tripId='',countryCode='',countryCodes=[]}=query
  const countries=countryCodes.join(',')
  const key=sourceQueryKey(kind,query,revision)
  const [result,setResult]=useState<{gateway:PlanningGateway;key:string;data:Awaited<ReturnType<PlanningGateway['sources']>>|null;error:string;errorCode?:string}|null>(null)
  useEffect(()=>{
    if(!enabled)return
    const controller=new AbortController()
    const timer=setTimeout(()=>{void gateway.sources(kind,controller.signal,{keyword,category,portId,destinationId,tripId,countryCode,countryCodes:countries?countries.split(','):[]}).then(data=>{if(!controller.signal.aborted)setResult({gateway,key,data,error:''})}).catch(e=>{if(!controller.signal.aborted){const fault=failure(e);setResult({gateway,key,data:null,error:fault.message,errorCode:fault.code})}})},keyword?250:0)
    return()=>{clearTimeout(timer);controller.abort()}
  },[gateway,kind,key,keyword,category,portId,destinationId,tripId,countryCode,countries,attempt,enabled])
  const current=result?.gateway===gateway&&result.key===key?result:null
  return {data:enabled?current?.data??[]:[],loading:enabled&&!current,error:enabled?current?.error??'':'',errorCode:enabled?current?.errorCode:undefined,retry:useCallback(()=>{setResult(null);setAttempt(n=>n+1)},[])}
}
