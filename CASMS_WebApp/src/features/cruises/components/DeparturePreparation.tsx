import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { cruiseApi } from '../api/cruise-api'
import { Notice, Button, ButtonLink, Loading, Panel } from '@/shared/ui'
import { canRoleOpenAdminPath } from '@/shared/ui/admin-v3'
import { useSessionAccess } from '@/shared/auth'
import type { CruiseDetailView } from '../model/cruise-view'
import { allowedDepartureSections, preparationIssueSection, preparationProblems, type DepartureSection } from '../model/preparation'
import styles from './DeparturePreparation.module.css'

export function DepartureTabs({section,onChange}:{section:DepartureSection;onChange:(section:DepartureSection)=>void}) {
  const access=useSessionAccess()
  const tabs=allowedDepartureSections(access)
  return <div role="tablist" aria-label="Chuẩn bị lần khởi hành" className={styles.tabs}>{tabs.map(([key,label],index)=><button type="button" role="tab" key={key} id={'departure-tab-'+key} aria-selected={section===key} aria-controls="departure-content" tabIndex={section===key?0:-1} onClick={()=>onChange(key)} onKeyDown={event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length
    onChange(tabs[next][0]);document.getElementById('departure-tab-'+tabs[next][0])?.focus()
  }}>{label}</button>)}</div>
}

export function PreparationOverview({detail,loading,onSection}:{detail:CruiseDetailView;loading:boolean;onSection:(section:DepartureSection)=>void}) {
  const access=useSessionAccess(),problems=preparationProblems(detail)
  return <div className={styles.summary}>
    <div className={styles.statusLine}><div><strong>{!access.canDo('CRUISE_VALIDATE')?'Thông tin lần khởi hành':loading?'Đang cập nhật điều kiện':detail.readiness.stale?'Dữ liệu đã đổi, cần kiểm tra lại':detail.readiness.state==='READY'?'Đạt kiểm tra sẵn sàng vận hành':detail.readiness.state==='BLOCKED'?'Còn điều kiện cần xử lý':'Chưa xác định điều kiện vận hành'}</strong><p>{detail.departurePort.portName+' → '+detail.returnPort.portName}</p></div>{access.canDo('CRUISE_VALIDATE')&&<Button tone="secondary" onClick={()=>onSection('checks')}>Xem điều kiện</Button>}</div>
    {access.canDo('CRUISE_VALIDATE')&&<Panel title="Việc cần xử lý">{loading?<Loading label="Đang đọc kết quả kiểm tra…"/>:problems.length?<ul className={styles.problems}>{problems.slice(0,3).map(check=><li key={check.key} className={styles.problem}><div><strong>{check.label}</strong><p>{check.reason}</p></div><Button tone="text" onClick={()=>onSection(allowedDepartureSections(access).some(([key])=>key===preparationIssueSection(check))?preparationIssueSection(check):'checks')}>Đi xử lý</Button></li>)}</ul>:<p>{detail.readiness.state==='READY'?'Không có vấn đề trong bộ kiểm tra vận hành hiện có.':'Chưa có đủ kết quả để xác định các điều kiện còn thiếu.'}</p>}{problems.length>3&&<Button tone="text" onClick={()=>onSection('checks')}>Xem toàn bộ điều kiện</Button>}</Panel>}
  </div>
}

export function ProgramDestinations({detail}:{detail:CruiseDetailView}) {
  const access=useSessionAccess()
  const canOpen=(path:string)=>canRoleOpenAdminPath(access.roles,path,'',access)
  return <Panel title="Chương trình và dịch vụ"><div className={styles.links}>
    {access.has('ACTIVITY_READ')&&canOpen('/admin/activities')&&<div className={styles.linkRow}><div><strong>Hoạt động trên tàu</strong><p>Mở danh mục và chọn đúng lần khởi hành khi cấu hình hoạt động.</p></div><ButtonLink tone="secondary" to="/admin/activities">Mở hoạt động</ButtonLink></div>}
    {access.has('EXCURSION_READ')&&<div className={styles.linkRow}><div><strong>Tour tham quan trên bờ</strong><p>Gắn với đúng lần ghé cảng trong lịch trình của lần khởi hành.</p></div>{detail.itinerary&&canOpen('/admin/itineraries/'+detail.itinerary.itineraryId)?<ButtonLink tone="secondary" to={'/admin/itineraries/'+detail.itinerary.itineraryId}>Mở các lần ghé</ButtonLink>:<span>Chưa có lịch trình liên kết</span>}</div>}
    {access.has('SERVICE_READ')&&canOpen('/admin/services')&&<div className={styles.linkRow}><div><strong>Dịch vụ và khung phục vụ</strong><p>Khung phục vụ không mặc nhiên tạo suất đặt hoặc lịch hẹn.</p></div><ButtonLink tone="secondary" to="/admin/services">Mở dịch vụ</ButtonLink></div>}
  </div></Panel>
}

export function DepartureSalesBoundary({cruiseId}:{cruiseId:string}){
  const access=useSessionAccess()
  const packages=useReadQuery('departure-packages:'+cruiseId,useCallback(signal=>cruiseApi.listPackages(cruiseId,signal),[cruiseId]))
  return <Panel title="Cấu hình bán">
    {packages.loading?<Loading label="Đang tải gói dịch vụ của lần khởi hành…"/>:packages.error?<Notice title="Chưa tải được gói dịch vụ" tone="error">{packages.error.message}<Button tone="secondary" onClick={packages.retry}>Thử lại</Button></Notice>:packages.data?.length?<ul className={styles.problems}>{packages.data.map(item=><li key={item.cruiseTourPackageId} className={styles.problem}><div><strong>{item.packageName}</strong><p>{item.packageCode} · {item.active?'Đang gắn với lần khởi hành':'Đã ngừng áp dụng'}</p></div></li>)}</ul>:<p>Chưa có gói dịch vụ gắn với lần khởi hành.</p>}
    <div className={styles.scope}><p>Chưa có hợp đồng tích hợp để mở bán theo sản phẩm, dừng nhận booking mới và mở lại tại màn này.</p><p>Phát hành lần khởi hành và kết quả sẵn sàng vận hành không thay thế điều kiện mở bán.</p></div>{access.has('BOOKING_READ')&&canRoleOpenAdminPath(access.roles,'/admin/bookings','',access)&&<div className={styles.linkRow}><div><strong>Đặt chỗ hiện có</strong><p>Tra cứu theo lần khởi hành trong chức năng đặt chỗ.</p></div><ButtonLink tone="secondary" to="/admin/bookings">Mở danh sách đặt chỗ</ButtonLink></div>}</Panel>
}
