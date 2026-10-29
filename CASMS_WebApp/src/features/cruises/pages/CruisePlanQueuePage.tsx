import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {domainStatus} from '@/shared/i18n/business-copy'
import {Button,ButtonLink,DataTable,Empty,Loading,Notice,PageHeader,Panel,PermissionLink as Link} from '@/shared/ui'
import {mainflowApi} from '../api/mainflow-api'
import {CruiseFrame} from '../components/CruiseUI'
import styles from '../components/Cruises.module.css'
export function CruisePlanQueuePage(){
 const access=useSessionAccess(),allowed=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ')
 const query=useReadQuery(`submitted-plans:${access.userId}:${allowed}`,useCallback(signal=>allowed?mainflowApi.queue(signal):Promise.resolve(null),[allowed]))
 return <CruiseFrame><div className={styles.content}>
  <PageHeader breadcrumb="VẬN HÀNH" title="Kế hoạch chờ OPS xét duyệt"  actions={<ButtonLink to="/admin/cruises">Danh sách lần khởi hành</ButtonLink>}/>
  {!allowed?<Notice title="Bạn không có quyền thực hiện"><p>Tài khoản hiện tại không được phân quyền cho thao tác này.</p></Notice>:<Panel title="Danh sách chờ xét duyệt">
   {query.loading&&<Loading/>}{query.error&&<Notice title="Chưa tải được kế hoạch chờ xét duyệt"><Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
   {!query.loading&&!query.error&&query.data?.length===0&&<Empty title="Chưa có kế hoạch chờ xét duyệt">Các kế hoạch CRM gửi xét duyệt sẽ xuất hiện tại đây. Bạn vẫn có thể xem các lần khởi hành trong menu.</Empty>}
   {!query.loading&&!query.error&&Boolean(query.data?.length)&&<DataTable label="Kế hoạch chờ OPS xét duyệt" headers={['Lần khởi hành','Phiên bản đã gửi','Người gửi','Thời điểm gửi','Trạng thái kế hoạch']}>
    {query.data!.map(plan=><tr key={plan.cruiseId}><td><Link to={`/admin/cruises/${encodeURIComponent(plan.cruiseId)}`}>{plan.cruiseCode}</Link></td><td>{plan.submittedRevision}</td><td>{plan.submittedByName??'Chưa xác định'}</td><td>{plan.submittedAt?new Date(plan.submittedAt).toLocaleString('vi-VN'):'Chưa xác định'}</td><td>{domainStatus('cruise.plan',plan.planStatus)}</td></tr>)}
   </DataTable>}
  </Panel>}
 </div></CruiseFrame>
}
