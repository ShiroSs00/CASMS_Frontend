import { useCallback, useState } from 'react'
import { apiRequest,useReadQuery } from '@/shared/api'
import { Button, Empty, ListFooter, Loading, Notice, Panel, TechnicalDetails } from '@/shared/ui'

type HistoryRow={auditId:string;actorUserId:string|null;occurredAt:string;action:string;detail:string|null}
function historyPage(value:unknown,id:string):{content:HistoryRow[];totalPages:number} {
  if(!value||typeof value!=='object')throw new Error('Chưa đọc được lịch sử cập nhật.')
  const page=value as Record<string,unknown>
  if(!Array.isArray(page.content)||!Number.isSafeInteger(page.totalPages)||(page.totalPages as number)<0)throw new Error('Thông tin phân trang lịch sử chưa hợp lệ.')
  const content=page.content.map((value:unknown)=>{
    if(!value||typeof value!=='object')throw new Error('Sự kiện lịch sử chưa hợp lệ.')
    const row=value as Record<string,unknown>
    if(row.entityId!==id||typeof row.auditId!=='string'||!row.auditId||typeof row.action!=='string'||typeof row.occurredAt!=='string'||!Number.isFinite(Date.parse(row.occurredAt))||['actorUserId','detail'].some(key=>row[key]!=null&&typeof row[key]!=='string'))throw new Error('Sự kiện lịch sử không khớp danh mục đang xem.')
    return {auditId:row.auditId,actorUserId:row.actorUserId as string??null,occurredAt:row.occurredAt,action:row.action,detail:row.detail as string??null}
  })
  if(new Set(content.map(row=>row.auditId)).size!==content.length)throw new Error('Lịch sử trả về có sự kiện trùng. Tải lại để đối chiếu.')
  return {content,totalPages:page.totalPages as number}
}
function actionLabel(action:string,kind:'port'|'destination') {
  const suffix=kind==='port'?'_PORT':'_DESTINATION'
  const operation=action.endsWith(suffix)?action.slice(0,-suffix.length):''
  return ({CREATE:'Tạo mới',UPDATE:'Cập nhật thông tin',ACTIVATE:'Kích hoạt',DEACTIVATE:'Ngừng kích hoạt',DELETE_UNUSED:'Xóa khi chưa sử dụng'} as Record<string,string>)[operation]??'Thay đổi danh mục'
}
export function DirectoryHistory({kind,id}:{kind:'port'|'destination';id:string}){
 const [page,setPage]=useState(0)
 const history=useReadQuery(`directory-history:${kind}:${id}:${page}`,useCallback(async signal=>historyPage(await apiRequest(`/${kind==='port'?'ports':'destinations'}/${encodeURIComponent(id)}/history`,{signal,query:{page,size:10}}),id),[kind,id,page]))
 return <Panel title="Lịch sử cập nhật">
   {history.loading?<Loading label="Đang tải lịch sử…"/>:history.error?<Notice title="Chưa tải được lịch sử" tone="error"><p>{history.error.message}</p><Button onClick={history.retry}>Thử lại</Button></Notice>:history.data&&<>
     {!history.data.content.length?<Empty title="Chưa ghi nhận lịch sử cập nhật"/>:history.data.content.map(row=><details key={row.auditId}><summary>{new Date(row.occurredAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {actionLabel(row.action,kind)}</summary><p>Chi tiết sự kiện đã được ghi nhận:</p>{row.detail?<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.detail}</pre>:<p>Không có nội dung chi tiết.</p>}<TechnicalDetails entries={[["Tài khoản thực hiện",row.actorUserId],["Mã sự kiện",row.auditId]]}/></details>)}
     {history.data.totalPages>1&&<ListFooter summary={`Trang ${page+1} / ${history.data.totalPages}`}><Button autoWidth tone="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Trang trước</Button><Button autoWidth tone="secondary" disabled={page+1>=history.data.totalPages} onClick={()=>setPage(p=>p+1)}>Trang sau</Button></ListFooter>}
   </>}
 </Panel>
}