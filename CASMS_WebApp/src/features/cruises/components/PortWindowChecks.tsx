import type { PortWindowCheck } from '../model/departure-contract'
import { Badge } from '@/shared/ui'
export function PortWindowChecks({checks}:{checks:PortWindowCheck[]}){
 if(!checks.length)return <p>Chưa có bằng chứng kiểm tra khung giờ cảng.</p>
 return <ul>{checks.map((check,index)=><li key={`${check.portId}:${check.movementType}:${index}`}><Badge label={check.status==='PASS'?'Đáp ứng khung giờ':'Chưa đáp ứng khung giờ'} tone={check.status==='PASS'?'success':'error'}/><strong> {check.movementType==='ARRIVAL'?'Tàu đến':'Tàu rời'} · {check.evaluatedLocalDateTime?.replace('T',' ')??'Chưa có ngày/giờ hợp lệ'}</strong><p>{check.portTimeZoneId??'Chưa xác định múi giờ'} · {check.message}</p>{check.sourceReference&&<p>Nguồn: {check.sourceReference} · Revision {check.matchedRevision??check.closureRevision??'chưa xác định'}</p>}</li>)}</ul>
}
