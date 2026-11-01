import { useCallback, useState } from 'react'
import { apiRequest,useReadQuery } from '@/shared/api'
import { Button, Loading, Notice, Panel } from '@/shared/ui'
export function DirectoryHistory({kind,id}:{kind:'port'|'destination';id:string}){
 const [page,setPage]=useState(0)
 const history=useReadQuery(`directory-history:${kind}:${id}:${page}`,useCallback(signal=>apiRequest<{content:{auditId:string;actorUserId:string;occurredAt:string;action:string;detail:string}[];totalPages:number}>(`/${kind==='port'?'ports':'destinations'}/${encodeURIComponent(id)}/history`,{signal,query:{page,size:10}}),[kind,id,page]))
 return <Panel title="Lịch sử cập nhật">{history.loading?<Loading label="Đang tải lịch sử…"/>:history.error?<Notice title="Chưa tải được lịch sử" tone="error"><Button onClick={history.retry}>Thử lại</Button></Notice>:<>{!history.data?.content.length?<p>Chưa ghi nhận lịch sử. Dữ liệu thiếu không được phục dựng từ thông tin hiện tại.</p>:history.data.content.map(row=><details key={row.auditId}><summary>{new Date(row.occurredAt).toLocaleString('vi-VN')} · {row.action}</summary><p>Người thực hiện: {row.actorUserId}</p><pre>{row.detail}</pre></details>)}<Button tone="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Trước</Button><Button tone="secondary" disabled={page+1>=(history.data?.totalPages??0)} onClick={()=>setPage(p=>p+1)}>Sau</Button></>}</Panel>
}
