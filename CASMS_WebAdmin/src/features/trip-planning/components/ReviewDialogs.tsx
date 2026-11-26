import { violationTarget } from '../model/violation-target'
import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Empty, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { usePlanning } from '../hooks'
import { countryLabel, domesticRegionLabel, shortTime, versionLabels, type Content, type Report, type Trip, type TripInfo, type Version, type Violation } from '../model/plan'
import styles from '../Planning.module.css'
import { scheduleDayTypeLabel } from '../model/day-labels'
const deferredLabels:Record<string,string>={FLEET_COMPATIBILITY_DEFERRED:'Chưa kiểm tra sự phù hợp với tàu được phân công.',NEEDS_SAILING_DATE:'Cần ngày khởi hành thực tế để kiểm tra thời gian tuyệt đối.'}

export function InfoConflictDialog({trip,local,onClose,onReplace}:{trip:Trip;local:TripInfo;onClose:()=>void;onReplace:(trip:Trip)=>void}) {
  const {gateway}=usePlanning(),[confirm,setConfirm]=useState(false)
  const query=useReadQuery('planning-info-compare:'+trip.tripId,useCallback(signal=>gateway.getTrip(trip.tripId,signal),[gateway,trip.tripId]))
  const info=(value:TripInfo)=><dl><dt>Tên chuyến</dt><dd>{value.name}</dd><dt>Thời lượng</dt><dd>{value.durationBand==='SHORT'?'Ngắn ngày':value.durationBand==='LONG'?'Dài ngày':'Chưa chọn'}</dd><dt>Phạm vi</dt><dd>{value.scope==='DOMESTIC'?'Trong nước':value.scope==='INTERNATIONAL'?'Ngoài nước':'Chưa chọn'}</dd><dt>Miền / quốc gia</dt><dd>{[...value.regionIds.map(domesticRegionLabel),...value.countryCodes.map(countryLabel)].join(', ')||'Chưa có'}</dd><dt>Giờ khởi hành sớm nhất (giờ Việt Nam)</dt><dd>{value.earliestDeparture||'Chưa thiết lập'}</dd><dt>Giờ khởi hành trễ nhất (giờ Việt Nam)</dt><dd>{value.latestDeparture||'Chưa thiết lập'}</dd><dt>Giới thiệu</dt><dd>{value.description||'Chưa có'}</dd></dl>
  return <Modal wide title="Đối chiếu thông tin chuyến" onClose={onClose} footer={<><Button tone="secondary" onClick={onClose}>Giữ bản nhập của tôi</Button>{query.data&&<Button tone={confirm?'danger':'primary'} onClick={()=>{if(!confirm)setConfirm(true);else onReplace(query.data!)}}>{confirm?'Xác nhận thay toàn bộ bản nhập':'Dùng bản đã lưu'}</Button>}</>}><p>Bản đang nhập chỉ được thay khi bạn chọn dùng dữ liệu đã lưu.</p>{query.loading?<Loading/>:query.error?<Notice title="Chưa đọc được thông tin" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:query.data&&<div className={styles.diff}><section><h3>Bản đang nhập</h3>{info(local)}</section><section><h3>Bản đã lưu trên hệ thống</h3>{info(query.data.info)}</section></div>}</Modal>
}

export function ValidationPanel({report,violations,onLocate,serverErrors=false}:{report:Report|null;violations:Violation[];onLocate:(v:Violation)=>void;serverErrors?:boolean}) {
  const rows = violations.length ? violations : report?.violations ?? []
  const blockers = rows.filter(row => row.severity === 'ERROR')
  const warnings = rows.filter(row => row.severity === 'WARNING')
  const ready = report?.validForSubmit && blockers.length === 0
  const groups = new Map<number | undefined, Violation[]>()
  for (const row of blockers) {
    const day = violationTarget(row).dayNumber
    groups.set(day, [...(groups.get(day) ?? []), row])
  }
  const orderedGroups = [...groups].sort(([a], [b]) => (a ?? 0) - (b ?? 0))

  return <Panel title={ready ? 'Có thể tạo mẫu' : blockers.length || serverErrors || report ? 'Cần bổ sung trước khi tạo mẫu' : 'Kết quả kiểm tra lịch trình'}>
    {orderedGroups.length > 0 && <div className={styles.validationGroups}>
      {orderedGroups.map(([day, items]) => <section key={day ?? 'general'} className={styles.validationGroup}>
        <h3>{day == null ? 'Toàn lịch trình' : 'Ngày ' + day}</h3>
        <ul>
          {items.map((row, index) => {
            const target = violationTarget(row)
            const action = target.kind === 'stops' && target.key ? 'Mở lần ghé cảng'
              : target.kind === 'entries' && target.key ? 'Mở mục chương trình'
              : target.fieldId ? 'Đến ô cần sửa'
              : target.dayNumber ? 'Mở ngày ' + target.dayNumber : null
            return <li key={row.code + ':' + index}>
              <span>{row.message}</span>
              {action && <Button tone="text" size="compact" onClick={() => onLocate(row)}>{action}</Button>}
            </li>
          })}
        </ul>
      </section>)}
    </div>}
    {blockers.length === 0 && <p>{ready ? 'Lịch trình hợp lệ. Bạn có thể tạo mẫu.'
      : report ? 'Lịch trình chưa đủ điều kiện tạo mẫu.'
      : 'Chưa có kết quả xác nhận điều kiện chốt.'}</p>}
    {warnings.length > 0 && <details className={styles.validationNotes}>
      <summary>Lưu ý khi lập lịch</summary>
      <ul>{warnings.map((row, index) => <li key={row.code + ':' + index}>{row.dayNumber ? 'Ngày ' + row.dayNumber + ' · ' : ''}{row.message}</li>)}</ul>
    </details>}
    {Boolean(report?.deferredChecks.length) && <details className={styles.validationNotes}>
      <summary>Kiểm tra khi tạo chuyến khởi hành</summary>
      <p>Các mục này cần ngày khởi hành hoặc tàu thực tế và không chặn chốt mẫu.</p>
      <ul>{report!.deferredChecks.map(value => <li key={value}>{deferredLabels[value] ?? 'Chưa đánh giá kiểm tra: ' + value}</li>)}</ul>
    </details>}
  </Panel>
}

export function HistoryDialog({versionId,tripId,onClose}:{versionId:string;tripId:string;onClose:()=>void}) {
  const {gateway}=usePlanning(),[page,setPage]=useState(0),[scope,setScope]=useState<'trip'|'version'>('version')
  const query=useReadQuery(`planning-history:${scope}:${versionId}:${tripId}:${page}`,useCallback(async signal=>{
    if(gateway.historyPage)return gateway.historyPage(scope==='trip'?tripId:versionId,scope,page,signal)
    const content=await gateway.history(versionId,signal);return {content,totalPages:1,totalElements:content.length}
  },[gateway,versionId,tripId,page,scope]))
  const labels:Record<string,string>={SUBMIT:'Gửi mẫu theo quy trình cũ',RETURN:'Trả lại chỉnh sửa',PUBLISH:'Công bố mẫu theo quy trình cũ',FINALIZE:businessCopy('trip.template.FINALIZE_ACTION'),SAVE_CONTENT:'Lưu nội dung',SAVE_DRAFT:'Lưu nháp',CREATE_VERSION:'Tạo phiên bản',CREATE_SCHEDULE_VERSION:'Tạo phiên bản',CREATE_TRIP:'Tạo chuyến đi',PATCH_DRAFT:'Sửa thông tin chuyến',CLONE_TRIP:'Nhân bản chuyến',ARCHIVE_TRIP:'Lưu trữ chuyến',WITHDRAW:'Thu hồi mẫu theo quy trình cũ',CANCEL_DRAFT:'Hủy bản nháp',MANAGE_DAYS_ADD:'Thêm ngày',MANAGE_DAYS_REMOVE:'Xóa ngày'}
  const formatAuditDetail = (detail?: string | null) => {
    if (!detail) return ''
    const pub = /^Published version (\d+)\.?$/i.exec(detail.trim())
    if (pub) return `Đã chốt phiên bản ${pub[1]}`
    const draft = /^Saved draft content with revision (\d+)\.?$/i.exec(detail.trim())
    if (draft) return `Đã lưu nội dung nháp (lần chỉnh sửa ${draft[1]})`
    const created = /^Created (?:schedule )?version (\d+)\.?$/i.exec(detail.trim())
    if (created) return `Đã tạo phiên bản lịch trình ${created[1]}`
    return detail
  }
  return <Modal wide title="Lịch sử chuyến và lịch trình" onClose={onClose}>
    <div className={styles.actions}><Button tone={scope==='version'?'primary':'secondary'} onClick={()=>{setScope('version');setPage(0)}}>Phiên bản hiện tại</Button>{gateway.historyPage&&<Button tone={scope==='trip'?'primary':'secondary'} onClick={()=>{setScope('trip');setPage(0)}}>Thông tin chuyến</Button>}</div>
    {query.loading?<Loading/>:query.error?<Notice title="Chưa tải được lịch sử" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>:!query.data?.content.length?<Empty title="Chưa có lịch sử"/>:<ol className={styles.violations}>{query.data.content.map(row=><li key={row.auditId}><strong>{labels[row.action]??'Cập nhật dữ liệu'}</strong><p>{new Date(row.occurredAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {row.actorName||'Chưa có tên người thực hiện'} · {row.result==='SUCCESS'?'Thành công':row.result}</p><p>{formatAuditDetail(row.detail)}</p></li>)}</ol>}
    {query.data&&<div className={styles.pagination}><span>{query.data.totalElements} sự kiện · Trang {page+1}/{Math.max(1,query.data.totalPages)}</span><div className={styles.actions}><Button tone="secondary" disabled={!page||query.loading} onClick={()=>setPage(n=>n-1)}>Trang trước</Button><Button tone="secondary" disabled={query.loading||page+1>=query.data.totalPages} onClick={()=>setPage(n=>n+1)}>Trang sau</Button></div></div>}
  </Modal>
}
function ContentSummary({content}:{content:Content}) {
  return <div className={styles.compareDays}>{content.days.map(day => {
    const stops = content.stops.filter(stop => stop.arrivalDayNumber === day.dayNumber)
    const events = content.entries.filter(entry => entry.startDayNumber === day.dayNumber)
    return <section key={day.key}>
      <h4>Ngày {day.dayNumber}{day.title ? ' · ' + day.title : ''}</h4>
      <p>{scheduleDayTypeLabel(day.dayNumber, content.days.length, day.dayType)}</p>
      {day.departurePortName && <p>Cảng khởi hành: {day.departurePortName} · {shortTime(day.plannedDepartureTime)}</p>}
      {stops.length > 0 && <ul>{stops.map(stop => <li key={stop.clientKey}><strong>{stop.portName || 'Cảng chưa có tên'}</strong>
        <div>Đến ngày {stop.arrivalDayNumber}, {shortTime(stop.plannedArrivalTime)} · {stop.isDisembarkation ? 'Kết thúc theo lịch' : 'Rời cảng'} ngày {stop.departureDayNumber}, {shortTime(stop.plannedDepartureTime)}</div>
      </li>)}</ul>}
      {events.length > 0 && <ul>{events.map(entry => <li key={entry.clientKey}>{entry.title} · {shortTime(entry.plannedStartTime)} đến ngày {entry.endDayNumber}, {shortTime(entry.plannedEndTime)}</li>)}</ul>}
      {!day.departurePortName && !stops.length && !events.length && <p>Chưa có cảng hoặc hoạt động.</p>}
    </section>
  })}</div>
}
export function ConflictDialog({trip,version,local,onClose,onReplace,onReconcile}:{trip:Trip;version:Version;local:Content;onClose:()=>void;onReconcile?:(trip:Trip,version:Version)=>void;onReplace:(trip:Trip,version:Version)=>void}) {
  const {gateway}=usePlanning(),[confirm,setConfirm]=useState(false),[confirmLocal,setConfirmLocal]=useState(false)
  const query=useReadQuery('planning-compare:'+version.versionId,useCallback(async signal=>{
    const [serverTrip,serverVersion]=await Promise.all([gateway.getTrip(trip.tripId,signal),gateway.version(version.versionId,signal)])
    return {trip:serverTrip,version:serverVersion}
  },[gateway,trip.tripId,version.versionId]))
  return <Modal wide title={confirm?'Thay bản nháp bằng bản đã lưu?':'Đối chiếu bản nháp và bản đã lưu'} onClose={onClose} footer={<><Button tone="secondary" onClick={onClose}>Giữ bản nháp của tôi</Button>{onReconcile&&query.data?.version.status==='DRAFT'&&!confirm&&<Button tone={confirmLocal?'danger':'secondary'} onClick={()=>{if(!confirmLocal)setConfirmLocal(true);else onReconcile(query.data!.trip,query.data!.version)}}>{confirmLocal?'Xác nhận giữ bản nhập để chỉnh tiếp':'Đối chiếu và giữ bản nhập'}</Button>}{query.data&&<Button tone={confirm?'danger':'primary'} onClick={()=>{if(!confirm)setConfirm(true);else onReplace(query.data!.trip,query.data!.version)}}>{confirm?'Xác nhận thay bản nháp':'Dùng bản đã lưu'}</Button>}</>}>
    <Notice title="Không tự ghi đè" tone="warning">So sánh hai bản trước khi chọn. Dùng bản đã lưu sẽ thay nội dung đang nhập. Nếu giữ bản nhập để chỉnh tiếp, hãy bổ sung thay đổi cần giữ từ bản đã lưu trước khi bấm Lưu nháp.</Notice>
    {query.loading ? <Loading label="Đang đọc bản đã lưu…"/> : query.error ? <Notice title="Chưa đọc được bản đã lưu" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice> : query.data && <div className={styles.diff}>
      <section><h3>Bản đang nhập</h3><ContentSummary content={local}/></section>
      <section><h3>Bản đã lưu · {versionLabels[query.data.version.status]}</h3><ContentSummary content={query.data.version}/></section>
    </div>}
  </Modal>
}
