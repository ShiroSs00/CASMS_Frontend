import { Link, useParams } from 'react-router'
import { useContext } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Loading, Notice } from '@/shared/ui'
import { AdminRoleContext, AdminShell, AdminWorkspaceIcon, adminWorkspaces, adminToolDescriptions, canEnterWorkspace, canOpenAdminItem, workspaceTools, primaryStaffRole, roleWorkspace, staffRoleLabel } from '@/shared/ui/admin-v3'
import styles from './AdminWorkspacePage.module.css'

export function AdminWorkspacePage() {
  const { workspaceId } = useParams()
  const access = useSessionAccess()
  const roles=useContext(AdminRoleContext)
  const workspace = adminWorkspaces.find(item => item.id === workspaceId)
  if (!workspace) return <AdminShell><Notice title="Không tìm thấy khu vực quản lý" tone="warning"><Link to="/admin">Về trung tâm quản lý</Link></Notice></AdminShell>
  const allowed = canEnterWorkspace(workspace, access)
  const title=roleWorkspace(roles)?.id===workspace.id?staffRoleLabel(roles):workspace.title
  const fleetManager=workspace.id==='operations' && primaryStaffRole(roles)==='SHIP_MANAGER'
  const action=fleetManager
    ? {label:'Tạo tàu',to:'/admin/ships/new',permission:'SHIP_CREATE'} : workspace.action
  const description=fleetManager?'Quản lý thông tin đội tàu, cấu trúc boong, cabin và quy định áp dụng cho tàu.':workspace.description
  const steps=fleetManager?['Cập nhật thông tin và trạng thái tàu.','Quản lý boong và bố trí cabin.','Kiểm tra sức chứa và tình trạng sẵn sàng của tàu.','Rà soát các quy định áp dụng cho đội tàu.']:workspace.steps
  return <AdminShell><div className={styles.page}>
    <header className={styles.header}><div className={styles.identity}><span className={styles.icon}><AdminWorkspaceIcon workspace={workspace.id} /></span><div><p>KHÔNG GIAN CHUYÊN BIỆT</p><h1>{title}</h1></div></div>{allowed && access.has(action.permission) && <Link className={styles.primary} to={action.to}>{action.label}<span aria-hidden="true">＋</span></Link>}</header>
    <p className={styles.description}>{description}</p>
    {access.status === 'loading' && <Loading label="Đang kiểm tra quyền khu vực…" />}
    {access.status === 'error' && <Notice title="Chưa tải được quyền truy cập" tone="error">{access.error} Vui lòng tải lại trang để thử lại.</Notice>}
    {access.status === 'ready' && !allowed && <Notice title="Bạn chưa được cấp quyền vào khu vực này" tone="warning">Liên hệ quản trị viên để được phân công quyền phù hợp. <Link to="/admin">Xem các khu vực khác</Link></Notice>}
    {allowed && <div className={styles.layout}><section aria-labelledby="workspace-tools-title"><div className={styles.sectionHeading}><h2 id="workspace-tools-title">Công cụ quản lý</h2><span>{workspace.responsibility}</span></div><div className={styles.tools}>{workspaceTools(workspace).filter(item=>canOpenAdminItem(item,access)).map((item,index) => {
      const available = canOpenAdminItem(item,access)
      return <article key={item.to} className={styles.tool}><span className={styles.toolNumber}>0{index+1}</span><div><h3>{available ? <Link to={item.to!}>{item.label}<span aria-hidden="true">↗</span></Link> : item.label}</h3><p>{adminToolDescriptions[item.to!.split('/')[2]]}</p>{!available && <span className={styles.unavailable}>Chưa có quyền truy cập</span>}</div></article>
    })}</div></section><aside className={styles.guide} aria-labelledby="workspace-guide-title"><span className={styles.guideLabel}>GỢI Ý CÔNG VIỆC</span><h2 id="workspace-guide-title">Bắt đầu từ đâu?</h2><ol>{steps.map(step => <li key={step}>{step}</li>)}</ol><p>Thực hiện theo dữ liệu và điều kiện tại từng màn hình nghiệp vụ.</p><Link to="/admin/workflow">Xem quy trình tổng thể →</Link></aside></div>}
  </div></AdminShell>
}
