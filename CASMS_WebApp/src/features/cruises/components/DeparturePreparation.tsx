import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { cruiseApi } from '../api/cruise-api'
import { Notice, Button, ButtonLink, Loading, Panel, ReadinessIndicator } from '@/shared/ui'
import { canRoleOpenAdminPath } from '@/shared/ui/admin-v3'
import { useSessionAccess } from '@/shared/auth'
import type { CruiseDetailView } from '../model/cruise-view'
import { allowedDepartureSections, preparationIssueSection, preparationProblems, type DepartureSection } from '../model/preparation'
import styles from './DeparturePreparation.module.css'
import {preparationApi} from '../api/preparation-api'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'

const preparationGroups: readonly { code:string; title:string; destination:DepartureSection }[] = [
  { code:'TECHNICAL_NAUTICAL', title:'Kỹ thuật tàu và hàng hải', destination:'resources' },
  { code:'HOTEL_CABIN', title:'Buồng phòng và cabin', destination:'sales' },
  { code:'FOOD_BEVERAGE', title:'Ẩm thực và phục vụ', destination:'program' },
  { code:'ENTERTAINMENT_SHORE', title:'Hoạt động và tham quan trên bờ', destination:'program' },
  { code:'SAFETY_CREW', title:'An toàn và thuyền viên', destination:'resources' },
]

export function DepartureTabs({section,onChange}:{section:DepartureSection;onChange:(section:DepartureSection)=>void}) {
  const access=useSessionAccess()
  const manager=access.roles.includes('CRUISE_MANAGER')&&!access.roles.includes('OPERATIONS_MANAGER')
  const tabs=allowedDepartureSections(access)
  return <div role="tablist" aria-label="Chuẩn bị lần khởi hành" className={`${styles.tabs} ${manager?styles.managerTabs:''}`}>{tabs.map(([key,label],index)=><button type="button" role="tab" key={key} id={'departure-tab-'+key} aria-selected={section===key} aria-controls={'departure-panel-'+key} tabIndex={section===key?0:-1} onClick={()=>onChange(key)} onKeyDown={event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length
    onChange(tabs[next][0]);document.getElementById('departure-tab-'+tabs[next][0])?.focus()
  }}>{manager&&key==='sales'?'Cabin và khách':label}</button>)}</div>
}

export function PreparationOverview({detail,loading,onSection}:{detail:CruiseDetailView;loading:boolean;onSection:(section:DepartureSection)=>void}) {
  const access=useSessionAccess(),problems=preparationProblems(detail),sections=allowedDepartureSections(access)
  const showChecks=sections.some(([key])=>key==='checks')
  const canRead=access.has('CRUISE_PREPARATION_READ'),cruiseId=detail.cruise.cruiseId
  const preparation=useReadQuery(`preparation-overview:${access.userId}:${cruiseId}:${detail.cruise.revision}:${canRead}`,useCallback(signal=>canRead?preparationApi.get(cruiseId,signal):Promise.resolve(null),[canRead,cruiseId]))
  return <div className={styles.summary}>
    <div className={styles.statusLine}><div><strong>{!showChecks||!access.canDo('CRUISE_VALIDATE')?'Thông tin lần khởi hành':loading?'Đang cập nhật điều kiện':detail.readiness.stale?'Dữ liệu đã đổi, cần kiểm tra lại':detail.readiness.state==='READY'?'Đạt kiểm tra sẵn sàng vận hành':detail.readiness.state==='BLOCKED'?'Còn điều kiện cần xử lý':'Chưa xác định điều kiện vận hành'}</strong><p>{detail.departurePort.portName+' → '+detail.returnPort.portName}</p></div>{showChecks&&access.canDo('CRUISE_VALIDATE')&&<Button tone="secondary" onClick={()=>onSection('checks')}>Xem điều kiện</Button>}</div>
    <Panel title="Chuẩn bị lần khởi hành" subtitle="Các phần việc dùng chung hồ sơ; việc phân công tàu không ngăn xem những phần khác.">
      {showChecks&&<div className={styles.workspaceIntro}><div><strong>Tình trạng kiểm tra vận hành</strong><p>Kết quả kiểm tra không thay thế xác nhận của từng bộ phận hoặc quyết định mở bán.</p></div>{loading ? <Loading label="Đang cập nhật…"/> : <ReadinessIndicator state={detail.readiness.stale?'UNKNOWN':detail.readiness.state}/>}</div>}
      <p className={styles.workspaceNote}>{businessCopy('preparation.dashboard.responsibility')}</p>
      {preparation.loading&&<Loading/>}{preparation.error&&<Notice title="Chưa tải được hồ sơ chuẩn bị"><Button onClick={preparation.retry}>Thử lại</Button></Notice>}
      <div className={styles.preparationGroups} aria-label="Các nhóm chuẩn bị">
        {preparationGroups.map(group=><section key={group.code} className={styles.preparationGroup}>
          <div><h3>{group.title}</h3><p>{preparation.data?domainStatus('preparation.section',preparation.data.sections.find(s=>s.sectionCode===group.code)?.status??'UNKNOWN'):'Chưa xác định'}</p></div>
          {sections.some(([key])=>key===group.destination) ? <Button tone="secondary" onClick={()=>onSection(group.destination)}>Xem công việc liên quan</Button> : <span>Chưa có quyền xem phần liên quan</span>}
        </section>)}
      </div>
      <div className={styles.workLinks}>{sections.filter(([key])=>key!=='overview').map(([key,label])=><button key={key} type="button" onClick={()=>onSection(key)}><span>{!showChecks&&key==='sales'?'Cabin và khách':label}</span><span aria-hidden="true">→</span></button>)}</div>
    </Panel>
    {showChecks&&access.canDo('CRUISE_VALIDATE')&&<Panel title="Việc cần xử lý">{loading?<Loading label="Đang đọc kết quả kiểm tra…"/>:problems.length?<ul className={styles.problems}>{problems.slice(0,3).map(check=><li key={check.key} className={styles.problem}><div><strong>{check.label}</strong><p>{check.reason}</p></div><Button tone="text" onClick={()=>onSection(allowedDepartureSections(access).some(([key])=>key===preparationIssueSection(check))?preparationIssueSection(check):'checks')}>Đi xử lý</Button></li>)}</ul>:<p>{detail.readiness.state==='READY'?'Không có vấn đề trong bộ kiểm tra vận hành hiện có.':'Chưa có đủ kết quả để xác định các điều kiện còn thiếu.'}</p>}{problems.length>3&&<Button tone="text" onClick={()=>onSection('checks')}>Xem toàn bộ điều kiện</Button>}</Panel>}
  </div>
}

export function ProgramDestinations({detail}:{detail:CruiseDetailView}) {
  const access=useSessionAccess()
  const canOpen=(path:string)=>canRoleOpenAdminPath(access.roles,path,'',access)
  return <Panel title="Chương trình và dịch vụ"><div className={styles.links}>
    {access.has('ACTIVITY_READ')&&canOpen('/admin/activities')&&<div className={styles.linkRow}><div><strong>Hoạt động trên tàu</strong><p>Cấu hình hoạt động của lần khởi hành đang xem.</p></div><ButtonLink tone="secondary" to={access.canDo('ACTIVITY_CREATE')&&canOpen('/admin/activities/new')?'/admin/activities/new?'+new URLSearchParams({cruiseId:detail.cruise.cruiseId,returnTo:'/admin/cruises/'+detail.cruise.cruiseId+'?section=program'}):'/admin/activities?'+new URLSearchParams({cruiseId:detail.cruise.cruiseId})}>{access.canDo('ACTIVITY_CREATE')?'Tạo hoạt động cho chuyến':'Mở hoạt động'}</ButtonLink></div>}
    {access.has('EXCURSION_READ')&&<div className={styles.linkRow}><div><strong>Tour tham quan trên bờ</strong><p>Đối chiếu đúng lần ghé và giờ địa phương của cảng; cùng một cảng có thể được ghé nhiều lần.</p></div>{allowedDepartureSections(access).some(([key])=>key==='schedule')?<ButtonLink tone="secondary" to={'/admin/cruises/'+encodeURIComponent(detail.cruise.cruiseId)+'?section=schedule'}>Xem lịch và lần ghé</ButtonLink>:<span>Chưa có quyền xem lịch lần khởi hành</span>}</div>}
    {access.has('SERVICE_READ')&&canOpen('/admin/services')&&<div className={styles.linkRow}><div><strong>Dịch vụ và khung phục vụ</strong><p>Cần đối chiếu kế hoạch phục vụ và bằng chứng với bộ phận phụ trách. Khung phục vụ không mặc nhiên tạo suất đặt hoặc xác nhận hoàn tất.</p></div><ButtonLink tone="secondary" to="/admin/services">Mở dịch vụ</ButtonLink></div>}
  </div></Panel>
}

export function DepartureSalesBoundary({cruiseId}:{cruiseId:string}){
  const access=useSessionAccess()
  const packages=useReadQuery('departure-packages:'+cruiseId,useCallback(signal=>cruiseApi.listPackages(cruiseId,signal),[cruiseId]))
  return <Panel title="Cấu hình bán">
    {packages.loading?<Loading label="Đang tải gói dịch vụ của lần khởi hành…"/>:packages.error?<Notice title="Chưa tải được gói dịch vụ" tone="error">{packages.error.message}<Button tone="secondary" onClick={packages.retry}>Thử lại</Button></Notice>:packages.data?.length?<ul className={styles.problems}>{packages.data.map(item=><li key={item.cruiseTourPackageId} className={styles.problem}><div><strong>{item.packageName}</strong><p>{item.packageCode} · {item.active?'Đang gắn với lần khởi hành':'Đã ngừng áp dụng'}</p></div></li>)}</ul>:<p>Chưa có gói dịch vụ gắn với lần khởi hành.</p>}
    <div className={styles.scope}><p>Chưa thể xác nhận phạm vi nhận đặt chỗ. Cần hoàn tất kiểm tra giá, quy định và sản phẩm được phép bán trước khi mở hoặc mở lại bán.</p><p>Phát hành lần khởi hành và kết quả sẵn sàng vận hành không thay thế điều kiện mở bán.</p></div>{access.has('BOOKING_READ')&&canRoleOpenAdminPath(access.roles,'/admin/bookings','',access)&&<div className={styles.linkRow}><div><strong>Đặt chỗ hiện có</strong><p>Tra cứu theo lần khởi hành trong chức năng đặt chỗ.</p></div><ButtonLink tone="secondary" to="/admin/bookings">Mở danh sách đặt chỗ</ButtonLink></div>}</Panel>
}
