import {useRef,useState} from 'react'
import {Button,Notice} from '@/shared/ui'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'

export function useCruisePackageMutation(refresh:()=>void,onConfirmed?:()=>void,reconcile?:()=>Promise<boolean>) {
  const lock=useRef(false),[busy,setBusy]=useState(false),[needsReview,setNeedsReview]=useState(false)
  const [message,setMessage]=useState(''),[error,setError]=useState('')
  async function run(action:()=>Promise<unknown>,success:string) {
    if(lock.current||needsReview)return false
    lock.current=true;setBusy(true);setMessage('');setError('')
    try { await action();setMessage(success);refresh();onConfirmed?.();return true }
    catch(reason) { setNeedsReview(mutationOutcomeUnknown(reason));setError(reason instanceof Error?reason.message:'Chưa xác nhận được kết quả thao tác.');return false }
    finally {lock.current=false;setBusy(false)}
  }
  async function review() {
    if(lock.current)return
    if(!needsReview){refresh();setError('');return}
    lock.current=true;setBusy(true)
    try {
      if(reconcile&&await reconcile()){setNeedsReview(false);setError('');setMessage('Đã đối chiếu kết quả đã lưu.');refresh();onConfirmed?.()}
      else {refresh();setError('Chưa xác định được kết quả thao tác đã gửi. Không tự gửi lại; cần tiếp tục đối chiếu dữ liệu đã lưu.')}
    }catch(reason){setError(reason instanceof Error?reason.message:'Chưa đối chiếu được dữ liệu đã lưu.')}
    finally{lock.current=false;setBusy(false)}
  }
  return { busy,needsReview,run, feedback:<>
    {message&&<Notice title="Kết quả thao tác" tone="success"><p>{message}</p></Notice>}
    {error&&<Notice title={needsReview?'Cần đối chiếu dữ liệu':'Chưa thực hiện được'} tone="error"><p>{error}</p><p>Nội dung nhập được giữ lại.{needsReview?' Chỉ mở lại thao tác sau khi xác nhận được kết quả đã lưu.':''}</p><Button tone="secondary" disabled={busy} onClick={()=>void review()}>{needsReview?'Đối chiếu kết quả đã lưu':'Tải lại dữ liệu'}</Button></Notice>}
  </> }
}
