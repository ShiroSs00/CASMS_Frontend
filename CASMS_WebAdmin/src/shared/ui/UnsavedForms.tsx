import {useState,useCallback,type ReactNode} from 'react'
import {Button,Modal} from './AdminUI'
import {useUnsavedFormGuard} from './useUnsavedFormGuard'
import {Changes,WorkspaceChange,type FormState} from './form-change-context'

/** One router blocker for a workspace containing several independently saved forms. */
export function UnsavedForms({children}:{children:ReactNode}){
 const [forms,setForms]=useState<Record<string,FormState>>({})
 const [pending,setPending]=useState<(()=>void)|null>(null)
 const update=useCallback((id:string,state:FormState|null)=>setForms(old=>{
  if(!state||!state.dirty&&!state.busy){if(!old[id])return old;const next={...old};delete next[id];return next}
  if(old[id]?.dirty===state.dirty&&old[id]?.busy===state.busy)return old
  return{...old,[id]:state}
 }),[])
 const dirty=Object.values(forms).some(form=>form.dirty)
 const busy=Object.values(forms).some(form=>form.busy)
 const guard=useUnsavedFormGuard(dirty,busy)
 const requestChange=(change:()=>void)=>{if(busy)return;if(dirty)setPending(()=>change);else change()}
 return <Changes.Provider value={update}><WorkspaceChange.Provider value={requestChange}>{children}{guard.prompt}{pending&&<Modal protectChanges={false} title="Bản nháp chưa được lưu" onClose={()=>setPending(null)} footer={<><Button tone="secondary" onClick={()=>setPending(null)}>Ở lại</Button><Button tone="danger" onClick={()=>{pending();setPending(null)}}>Bỏ thay đổi và chuyển lựa chọn</Button></>}><p>Chuyển lựa chọn sẽ đóng biểu mẫu hiện tại. Những thay đổi chưa lưu sẽ bị bỏ.</p></Modal>}</WorkspaceChange.Provider></Changes.Provider>
}
