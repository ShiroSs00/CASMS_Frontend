import { useCallback } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { Badge, Button, CollectionSummary, DataTable, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'

type UserLookup = { id:string; displayName?:string; username:string; status:string; capabilityLabel?:string }
export function AdminSystemPage() {
  const access=useSessionAccess()
  const allowed=access.has('USER_READ')
  const load=useCallback(async (signal:AbortSignal) => {
    if (!allowed) return []
    const users=await apiRequest<UserLookup[]>('/identity/users',{query:{status:'ACTIVE'},signal})
    if (!Array.isArray(users)||users.some(user=>!user||typeof user.id!=='string'||typeof user.username!=='string'||typeof user.status!=='string')) throw new ApiError('Không đọc được danh sách tài khoản.',502)
    return users
  },[allowed])
  const query=useReadQuery(`system-users:${access.userId}:${allowed}`,load)
  return <AdminShell><PageHeader breadcrumb="HỆ THỐNG" title="Tài khoản nhân sự" description="Tra cứu tài khoản nhân sự đang hoạt động." />
    {allowed && <CollectionSummary count={query.loading || query.error ? null : query.data?.length ?? null} label="Tài khoản đang hoạt động" scope="Kết quả danh sách được phép xem" />}
    <Panel title="Tài khoản đang hoạt động">
      {access.status==='loading'&&<Loading label="Đang kiểm tra quyền…" />}
      {access.status==='error'&&<Notice title="Chưa tải được quyền" tone="error">{access.error}</Notice>}
      {access.status==='ready'&&!allowed&&<Notice title="Chưa có quyền xem tài khoản" tone="warning">Liên hệ người quản trị phân quyền.</Notice>}
      {allowed&&query.loading&&<Loading label="Đang tải tài khoản…" />}
      {allowed&&query.error&&<Notice title="Không tải được tài khoản" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}
      {allowed && query.data && !query.data.length && <Empty title="Chưa có tài khoản trong danh sách" />}
      {allowed&&query.data&&query.data.length>0&&<DataTable label="Tài khoản đang hoạt động" headers={['Tên đăng nhập','Tên hiển thị','Trạng thái','Khả năng được phân công']}>{query.data.map(user=><tr key={user.id}><td>{user.username}</td><td>{user.displayName??'—'}</td><td><Badge label={user.status==='ACTIVE'?'Đang hoạt động':user.status} tone={user.status==='ACTIVE'?'success':'neutral'} /></td><td>{user.capabilityLabel??'—'}</td></tr>)}</DataTable>}
    </Panel>
  </AdminShell>
}
