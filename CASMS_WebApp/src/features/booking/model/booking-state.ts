import { useEffect, useState } from 'react'
export function useAdapterData<T>(load:(signal:AbortSignal)=>Promise<T>) {
 const [state,setState]=useState<{load:typeof load;attempt:number;data?:T;error?:string}|null>(null)
 const [attempt,setAttempt]=useState(0)
 useEffect(()=>{const controller=new AbortController();load(controller.signal).then(data=>{if(!controller.signal.aborted)setState({load,attempt,data})}).catch(()=>{if(!controller.signal.aborted)setState({load,attempt,error:'Không tải được dữ liệu. Vui lòng thử lại.'})});return()=>controller.abort()},[load,attempt])
 const current=state?.load===load&&state.attempt===attempt?state:null
 return {data:current?.data,error:current?.error,loading:!current,retry:()=>setAttempt(n=>n+1)}
}

