import {useCallback} from 'react'
import {Link} from 'react-router'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {domainStatus} from '@/shared/i18n/business-copy'
import {Button,Loading,Notice,Panel} from '@/shared/ui'
import {mainflowApi} from '../api/mainflow-api'
export function CruisePlanQueuePage(){
 const access=useSessionAccess(),allowed=access.roles.includes('OPERATIONS_MANAGER')&&access.has('CRUISE_READ')
 const query=useReadQuery(`submitted-plans:${access.userId}:${allowed}`,useCallback(signal=>allowed?mainflowApi.queue(signal):Promise.resolve(null),[allowed]))
 if(!allowed)return <Notice title="Bạn không có quyền thực hiện"><p>Tài khoản hiện tại không được phân quyền cho thao tác này.</p></Notice>
 return <Panel title="Kế hoạch chờ OPS xét duyệt">{query.loading&&<Loading/>}{query.error&&<Notice title="Không thể hoàn tất thao tác"><Button onClick={query.retry}>Tải lại dữ liệu</Button></Notice>}
  {query.data&&<table><thead><tr><th>Lần khởi hành</th><th>Phiên bản đã gửi</th><th>Người gửi</th><th>Thời điểm gửi</th><th>Trạng thái kế hoạch</th></tr></thead><tbody>{query.data.map(plan=><tr key={plan.cruiseId}><td><Link to={`/admin/cruises/${encodeURIComponent(plan.cruiseId)}`}>{plan.cruiseCode}</Link></td><td>{plan.submittedRevision}</td><td>{plan.submittedByName??'Chưa xác định'}</td><td>{plan.submittedAt?new Date(plan.submittedAt).toLocaleString('vi-VN'):'Chưa xác định'}</td><td>{domainStatus('cruise.plan',plan.planStatus)}</td></tr>)}</tbody></table>}
 </Panel>
}
