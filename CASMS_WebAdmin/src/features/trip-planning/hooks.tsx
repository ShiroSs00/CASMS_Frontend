import { useCallback, useContext, useEffect, useState } from 'react'

import { useUnsavedFormGuard } from '@/shared/ui'
import { Context } from './planning-context'
import { failure } from './api/live'
import type { PlanningGateway } from './api/gateway'
import { sourceQueryKey } from './model/source-query'
export function usePlanning(){const value=useContext(Context);if(!value)throw new Error('Planning provider missing');return value}
export function useUnsavedGuard(dirty:boolean,busy=false) {
  const {unsavedRef}=usePlanning()
  useEffect(()=>{unsavedRef.current=dirty||busy;return()=>{unsavedRef.current=false}},[dirty,busy,unsavedRef])
  const guard=useUnsavedFormGuard(dirty,busy,(current,next)=>current.pathname!==next.pathname||new URLSearchParams(current.search).get('versionId')!==new URLSearchParams(next.search).get('versionId'))
  return {prompt:guard.prompt,allowLeave:()=>{guard.allowLeave();unsavedRef.current=false}}
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

