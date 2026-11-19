import {useState,useCallback,type ReactNode} from 'react'
import {useUnsavedFormGuard} from './useUnsavedFormGuard'
import {Changes,WorkspaceChange,type FormState} from './form-change-context'

/** One router blocker for a workspace containing several independently saved forms. */
export function UnsavedForms({children}:{children:ReactNode}){
 const [forms,setForms]=useState<Record<string,FormState>>({})
 const update=useCallback((id:string,state:FormState|null)=>setForms(old=>{
  if(!state||!state.dirty&&!state.busy){if(!old[id])return old;const next={...old};delete next[id];return next}
  if(old[id]?.dirty===state.dirty&&old[id]?.busy===state.busy)return old
  return{...old,[id]:state}
 }),[])
 const guard=useUnsavedFormGuard(false,Object.values(forms).some(form=>form.busy))
 const requestChange=(change:()=>void)=>{if(Object.values(forms).some(form=>form.busy))return;change()}
 return <Changes.Provider value={update}><WorkspaceChange.Provider value={requestChange}>{children}{guard.prompt}</WorkspaceChange.Provider></Changes.Provider>
}
