import {Changes,WorkspaceChange} from './form-change-context'
import {useContext,useEffect,useId,useRef} from 'react'
import {useBlocker} from 'react-router'
import {Button,Modal} from './AdminUI'

type Route={pathname:string;search:string}
const different=(current:Route,next:Route)=>current.pathname!==next.pathname||current.search!==next.search
/** Shared form protection extracted from the itinerary editor; mount once per editing workspace. */
export function useUnsavedFormGuard(dirty:boolean,busy=false,changesContext:(current:Route,next:Route)=>boolean=different){
 const allowed=useRef(false)
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if((dirty||busy)&&!allowed.current){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty,busy])
 const blocker=useBlocker(({currentLocation,nextLocation})=>(dirty||busy)&&!allowed.current&&changesContext(currentLocation,nextLocation))
 const prompt=blocker.state==='blocked'?<Modal title={busy?'Đang xử lý yêu cầu':'Bản nháp chưa được lưu'} onClose={()=>blocker.reset()} footer={<><Button tone="secondary" onClick={()=>blocker.reset()}>Ở lại</Button><Button tone="danger" disabled={busy} onClick={()=>blocker.proceed()}>Bỏ thay đổi và rời trang</Button></>}>{busy?<p>Chờ yêu cầu hiện tại hoàn tất để xác định dữ liệu đã lưu trước khi rời trang.</p>:<p>Những thay đổi chưa lưu trên màn hình sẽ bị bỏ.</p>}</Modal>:null
 return{prompt,allowLeave:()=>{allowed.current=true}}
}

export const useWorkspaceChange=()=>useContext(WorkspaceChange)
export function useFormChanges(dirty:boolean,busy=false){
 const update=useContext(Changes),id=useId()
 useEffect(()=>{update?.(id,{dirty,busy});return()=>update?.(id,null)},[update,id,dirty,busy])
}
