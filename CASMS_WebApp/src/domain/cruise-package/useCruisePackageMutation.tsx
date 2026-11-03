import {useRef,useState} from 'react'
import {Button,Notice} from '@/shared/ui'

export function useCruisePackageMutation(refresh:()=>void,onConfirmed?:()=>void) {
  const lock=useRef(false),[busy,setBusy]=useState(false),[needsReview,setNeedsReview]=useState(false)
  const [message,setMessage]=useState(''),[error,setError]=useState('')
  async function run(action:()=>Promise<unknown>,success:string) {
    if(lock.current||needsReview)return false
    lock.current=true;setBusy(true);setMessage('');setError('')
    try { await action();setMessage(success);refresh();onConfirmed?.();return true }
    catch(reason) { setNeedsReview(true);setError(reason instanceof Error?reason.message:'Chưa xác nhận được kết quả thao tác.');return false }
    finally {lock.current=false;setBusy(false)}
  }
  return { busy,needsReview,run, feedback:<>
    {message&&<Notice title="Kết quả thao tác" tone="success"><p>{message}</p></Notice>}
    {error&&<Notice title="Cần đối chiếu dữ liệu" tone="error"><p>{error}</p><p>Nội dung nhập được giữ lại. Tải lại dữ liệu, kiểm tra kết quả và phiên bản trước khi thực hiện tiếp.</p><Button tone="secondary" disabled={busy} onClick={()=>{setNeedsReview(false);setError('');refresh()}}>Tải lại để đối chiếu</Button></Notice>}
  </> }
}
