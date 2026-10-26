import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Empty, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { usePlanning } from '../hooks'
import { versionLabels, type Content, type Report, type Trip, type TripInfo, type Version, type Violation } from '../model/plan'
import styles from '../Planning.module.css'
const deferredLabels:Record<string,string>={FLEET_COMPATIBILITY_DEFERRED:'Chưa kiểm tra sự phù hợp với tàu được phân công.',NEEDS_SAILING_DATE:'Cần ngày khởi hành thực tế để kiểm tra thời gian tuyệt đối.'}

export function InfoConflictDialog({trip,local,onClose,onReplace}:{trip:Trip;local:TripInfo;onClose:()=>void;onReplace:(trip:Trip)=>void}) {
  const {gateway}=usePlanning(),[confirm,setConfirm]=useState(false)
  const query=useReadQuery('planning-info-compare:'+trip.tripId,useCallback(signal=>gateway.getTrip(trip.tripId,signal),[gateway,trip.tripId]))
  const info=(value:TripInfo)=><dl><dt>Tên chuyến</dt><dd>{value.name}</dd><dt>Thời lượng</dt><dd>{value.durationBand==='SHORT'?'Ngắn ngày':value.durationBand==='LONG'?'Dài ngày':'Chưa chọn'}</dd><dt>Phạm vi</dt><dd>{value.scope==='DOMESTIC'?'Trong nước':value.scope==='INTERNATIONAL'?'Ngoài nước':'Chưa chọn'}</dd><dt>Miền / quốc gia</dt><dd>{[...value.regionIds,...value.countryCodes].join(', ')||'Chưa có'}</dd><dt>Giới thiệu</dt><dd>{value.description||'Chưa có'}</dd></dl>
  return <Modal wide title="Đối chiếu thông tin chuyến" onClose={onClose} footer={<><Button tone="secondary" onClick={onClose}>Giữ bản nhập của tôi</Button>{query.data&&<Button tone={confirm?'danger':'primary'} onClick={()=>{if(!confirm)setConfirm(true);else onReplace(query.data!)}}>{confirm?'Xác nhận thay toàn bộ bản nhập':'Dùng bản máy chủ'}</Button>}</>}><p>Không tự đổi revision để gửi đè. Chỉ thay bản nhập khi bạn xác nhận.</p>{query.loading?<Loading/>:query.error?<Notice title="Chưa đọc được thông tin" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:query.data&&<div className={styles.diff}><section><h3>Bản của bạn · r{trip.revision}</h3>{info(local)}</section><section><h3>Máy chủ · r{query.data.revision}</h3>{info(query.data.info)}</section></div>}</Modal>
}

export function ValidationPanel({report,violations,onLocate,serverErrors=false}:{report:Report|null;violations:Violation[];onLocate:(v:Violation)=>void;serverErrors?:boolean}) {
  const rows=violations.length?violations:report?.violations??[]
  const valid=Boolean(report?.validForSubmit)&&!rows.some(row=>row.severity==='ERROR')
  return <Panel title="Kiểm tra lịch trình">
    {report?<p>{valid?'Bản đã lưu đủ điều kiện gửi duyệt nội dung lịch trình.':'Sửa các mục bên dưới rồi kiểm tra lại.'}</p>:<p className={styles.muted}>{serverErrors?'Cần sửa các mục bên dưới.':'Các mục chưa hoàn tất trong bản đang chỉnh.'}</p>}
    {rows.length?<ul className={styles.violations}>{rows.map((row,i)=><li key={`${row.code}:${row.clientKey??row.dayNumber??''}:${row.field??''}:${i}`}><strong>{row.severity==='WARNING'?'Cảnh báo':'Lỗi'}{row.dayNumber?` · Ngày ${row.dayNumber}`:''}</strong><p>{row.message}</p>{(row.dayNumber||row.clientKey||row.fieldPath||row.actionHint)&&<Button tone="text" onClick={()=>onLocate(row)}>Xem đúng nội dung</Button>}</li>)}</ul>:<p>Chưa phát hiện lỗi trong phần dữ liệu được đối chiếu.</p>}
    {Boolean(report?.deferredChecks.length)&&<details><summary>Kiểm tra chưa thực hiện ({report!.deferredChecks.length})</summary><ul>{report!.deferredChecks.map(value=><li key={value}>{deferredLabels[value]??value}</li>)}</ul></details>}
  </Panel>
}
export function HistoryDialog({versionId,tripId,onClose}:{versionId:string;tripId:string;onClose:()=>void}) {
  const {gateway}=usePlanning(),[page,setPage]=useState(0),[scope,setScope]=useState<'trip'|'version'>('version')
  const query=useReadQuery(`planning-history:${scope}:${versionId}:${tripId}:${page}`,useCallback(async signal=>{
    if(gateway.historyPage)return gateway.historyPage(scope==='trip'?tripId:versionId,scope,page,signal)
    const content=await gateway.history(versionId,signal);return {content,totalPages:1,totalElements:content.length}
  },[gateway,versionId,tripId,page,scope]))
  const labels:Record<string,string>={SUBMIT:'Gửi duyệt',RETURN:'Trả lại chỉnh sửa',PUBLISH:'Phát hành lịch trình',SAVE_CONTENT:'Lưu nội dung',SAVE_DRAFT:'Lưu nháp',CREATE_VERSION:'Tạo phiên bản',CREATE_SCHEDULE_VERSION:'Tạo phiên bản',CREATE_TRIP:'Tạo chuyến đi',PATCH_DRAFT:'Sửa thông tin chuyến',CLONE_TRIP:'Nhân bản chuyến',ARCHIVE_TRIP:'Lưu trữ chuyến',WITHDRAW:'Thu hồi yêu cầu duyệt',CANCEL_DRAFT:'Hủy bản nháp',MANAGE_DAYS_ADD:'Thêm ngày',MANAGE_DAYS_REMOVE:'Xóa ngày'}
  return <Modal wide title="Lịch sử chuyến và lịch trình" onClose={onClose}>
    <div className={styles.actions}><Button tone={scope==='version'?'primary':'secondary'} onClick={()=>{setScope('version');setPage(0)}}>Phiên bản hiện tại</Button>{gateway.historyPage&&<Button tone={scope==='trip'?'primary':'secondary'} onClick={()=>{setScope('trip');setPage(0)}}>Thông tin chuyến</Button>}</div>
    <p className={styles.muted}>{scope==='trip'?'Các thay đổi thông tin cấp chuyến; không gộp thành lịch sử của từng phiên bản.':'Các sự kiện riêng của phiên bản đang mở.'}</p>
    {query.loading?<Loading/>:query.error?<Notice title="Chưa tải được lịch sử" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:!query.data?.content.length?<Empty title="Chưa có lịch sử"/>:<ol className={styles.violations}>{query.data.content.map(row=><li key={row.auditId}><strong>{labels[row.action]??'Cập nhật dữ liệu'}</strong><p>{new Date(row.occurredAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {row.actorName||'Chưa có tên người thực hiện'} · {row.result==='SUCCESS'?'Thành công':row.result}</p><p>{row.detail}</p></li>)}</ol>}
    {query.data&&<div className={styles.pagination}><span>{query.data.totalElements} sự kiện · Trang {page+1}/{Math.max(1,query.data.totalPages)}</span><div className={styles.actions}><Button tone="secondary" disabled={!page||query.loading} onClick={()=>setPage(n=>n-1)}>Trang trước</Button><Button tone="secondary" disabled={query.loading||page+1>=query.data.totalPages} onClick={()=>setPage(n=>n+1)}>Trang sau</Button></div></div>}
  </Modal>
}
function ContentSummary({content}:{content:Content}) {
  return <div className={styles.cards}>{content.days.map(day=><section className={styles.item} key={day.key}><strong>Ngày {day.dayNumber} · {day.title}</strong><p>{day.dayType==='PORT_DAY'?'Ngày ghé cảng':day.dayType==='SEA_DAY'?'Ngày trên biển':'Chưa chọn loại ngày'}</p>{content.stops.filter(s=>s.arrivalDayNumber<=day.dayNumber&&s.departureDayNumber>=day.dayNumber).map(s=><p key={s.clientKey}>{s.stopOrder}. {s.portName??'Cảng'} · Ngày {s.arrivalDayNumber} → {s.departureDayNumber}</p>)}{content.entries.filter(e=>e.startDayNumber===day.dayNumber).map(e=><p key={e.clientKey}>{e.title} · {e.plannedStartTime} → Ngày {e.endDayNumber} {e.plannedEndTime}</p>)}</section>)}</div>
}
export function ConflictDialog({trip,version,local,onClose,onReplace}:{trip:Trip;version:Version;local:Content;onClose:()=>void;onReplace:(trip:Trip,version:Version)=>void}) {
  const {gateway}=usePlanning(),[confirm,setConfirm]=useState(false)
  const query=useReadQuery('planning-compare:'+version.versionId,useCallback(async signal=>{
    const [serverTrip,serverVersion]=await Promise.all([gateway.getTrip(trip.tripId,signal),gateway.version(version.versionId,signal)])
    return {trip:serverTrip,version:serverVersion}
  },[gateway,trip.tripId,version.versionId]))
  return <Modal wide title={confirm?'Thay bản nháp bằng bản máy chủ?':'Đối chiếu bản nháp và bản máy chủ'} onClose={onClose} footer={<><Button tone="secondary" onClick={onClose}>Giữ bản nháp của tôi</Button>{query.data&&<Button tone={confirm?'danger':'primary'} onClick={()=>{if(!confirm)setConfirm(true);else onReplace(query.data!.trip,query.data!.version)}}>{confirm?'Xác nhận thay bản nháp':'Dùng bản máy chủ'}</Button>}</>}>
    <Notice title="Không tự ghi đè" tone="warning">Bản nhập local đang được giữ nguyên. Chỉ khi xác nhận dùng bản máy chủ, nội dung local mới được thay. Không tự nâng revision để gửi đè.</Notice>
    {query.loading?<Loading/>:query.error?<Notice title="Chưa đọc được bản máy chủ" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:query.data&&<div className={styles.diff}><section><h3>Bản của bạn</h3><p>Thông tin chuyến r{trip.revision} · Lịch trình r{version.revision}</p><ContentSummary content={local}/><details><summary>Tất cả dữ liệu để đối chiếu</summary><pre>{JSON.stringify({trip:trip.info,...local},null,2)}</pre></details></section><section><h3>Bản máy chủ · {versionLabels[query.data.version.status]}</h3><p>Thông tin chuyến r{query.data.trip.revision} · Lịch trình r{query.data.version.revision}</p><ContentSummary content={query.data.version}/><details><summary>Tất cả dữ liệu để đối chiếu</summary><pre>{JSON.stringify({trip:query.data.trip.info,days:query.data.version.days,stops:query.data.version.stops,entries:query.data.version.entries},null,2)}</pre></details></section></div>}
  </Modal>
}
