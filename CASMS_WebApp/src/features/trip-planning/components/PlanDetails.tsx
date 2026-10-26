import { useEffect, useRef, type ReactNode } from 'react'
import { Button, Modal, Notice } from '@/shared/ui'
import { countryLabel, domesticRegionLabel, kindLabels, shortTime, type Content, type Entry, type Stop, type Violation } from '../model/plan'
import styles from '../Planning.module.css'

type DetailProps={onClose:()=>void;violation?:Violation}

function DetailBody({children,violation,label}:{children:ReactNode;violation?:Violation;label:string}) {
  const body=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!violation)return
    const frame=requestAnimationFrame(()=>{body.current?.focus();body.current?.scrollIntoView({block:'start'})})
    return ()=>cancelAnimationFrame(frame)
  },[violation])
  return <div ref={body} tabIndex={-1} aria-label={label} className={styles.single}>
    {violation&&<Notice title="Vi phạm từ máy chủ" tone="warning">{violation.message}</Notice>}
    {children}
  </div>
}

function Detail({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}) {
  return <div className={wide?styles.detailSpan:undefined}><dt>{label}</dt><dd>{children??'Chưa có thông tin'}</dd></div>
}

const dayTime=(day:number|null|undefined,time:string|null|undefined)=>day?`Ngày ${day} · ${shortTime(time)}`:'Chưa thiết lập'
const text=(value:string|null|undefined)=>value?.trim()||'Chưa có thông tin'

export function StopDetails({stop,onClose,violation}:{stop?:Stop}&DetailProps) {
  return <Modal variant="drawer" wide title="Chi tiết lần ghé cảng" onClose={onClose} protectChanges={false} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
    <DetailBody violation={violation} label="Thông tin lần ghé cảng">
      {stop?<>
        <div className={styles.detailLead}><h3>{text(stop.portName)}</h3><p>{countryLabel(stop.countryCode)}{stop.countryCode==='VN'?` · ${domesticRegionLabel(stop.domesticRegion)}`:''}</p></div>
        <section className={styles.detailSection} aria-label="Thời gian ghé cảng">
          <p className={styles.timeContext}>Giờ địa phương của cảng · {text(stop.timeZoneId)}</p>
          <dl className={styles.detailGrid}>
            <Detail label="Đến cảng">{dayTime(stop.arrivalDayNumber,stop.plannedArrivalTime)}</Detail>
            <Detail label="Rời cảng">{dayTime(stop.departureDayNumber,stop.plannedDepartureTime)}</Detail>
            <Detail label="Hạn trở lại tàu" wide>{dayTime(stop.allAboardDayNumber,stop.allAboardTime)}</Detail>
          </dl>
        </section>
        <section className={styles.detailSection} aria-label="Thông tin lần ghé">
          <dl className={styles.detailGrid}>
            <Detail label="Thứ tự trong tuyến">{stop.stopOrder}</Detail>
            <Detail label="Loại lần ghé">{{NORMAL:'Thông thường',LATE_NIGHT:'Đến khuya',OVERNIGHT:'Qua đêm'}[stop.callType]}</Detail>
            <Detail label="Cách lên bờ" wide>{stop.arrivalMethod==='TENDER'?'Trung chuyển bằng tàu nhỏ':'Cập bến'}</Detail>
            <Detail label="Điểm đón">{stop.isEmbarkation?'Có':'Không'}</Detail>
            <Detail label="Điểm trả">{stop.isDisembarkation?'Có':'Không'}</Detail>
          </dl>
        </section>
      </>:<p className={styles.muted}>Chưa có thông tin lần ghé cảng.</p>}
    </DetailBody>
  </Modal>
}

export function EntryDetails({content,entry,kind,onClose,violation}:{content:Content;entry?:Entry;kind:Entry['kind']}&DetailProps) {
  const stop=content.stops.find(item=>item.clientKey===entry?.stopClientKey)
  return <Modal variant="drawer" wide title={`Chi tiết ${kindLabels[kind].toLocaleLowerCase('vi')}`} onClose={onClose} protectChanges={false} footer={<Button tone="secondary" onClick={onClose}>Đóng</Button>}>
    <DetailBody violation={violation} label="Thông tin mục lịch trình">
      {entry?<>
        <div className={styles.detailLead}><h3>{text(entry.title)}</h3><div className={styles.detailTags}><span>{kindLabels[entry.kind]}</span></div></div>
        <section className={styles.detailSection} aria-label="Thời gian thực hiện">
          <p className={styles.timeContext}>{entry.kind==='SHORE_EXCURSION'?`Giờ địa phương của cảng · ${text(entry.timeZoneId||stop?.timeZoneId)}`:'Giờ Việt Nam'}</p>
          <dl className={styles.detailGrid}>
            <Detail label="Bắt đầu">{dayTime(entry.startDayNumber,entry.plannedStartTime)}</Detail>
            <Detail label="Kết thúc">{dayTime(entry.endDayNumber,entry.plannedEndTime)}</Detail>
            {entry.kind==='SHORE_EXCURSION'&&<Detail label="Lần ghé cảng" wide>{stop?`${stop.stopOrder}. ${text(stop.portName)} · Ngày ${stop.arrivalDayNumber}–${stop.departureDayNumber}`:'Chưa có thông tin'}</Detail>}
          </dl>
        </section>
        <section className={styles.detailSection} aria-label="Địa điểm và thông tin bổ sung">
          <dl className={styles.detailGrid}>
            <Detail label="Địa điểm" wide>{text(entry.locationText||entry.displayLocation)}</Detail>
            {entry.displayLocation&&entry.locationText&&entry.displayLocation!==entry.locationText&&<Detail label="Vị trí tham chiếu" wide>{entry.displayLocation}</Detail>}
            <Detail label="Điểm tập trung" wide>{text(entry.meetingPoint)}</Detail>
            {entry.referenceShipName&&<Detail label="Tàu tham chiếu">{entry.referenceShipName}</Detail>}
            {entry.categoryName&&<Detail label="Nhóm">{entry.categoryName}</Detail>}
            {entry.notes?.trim()&&<Detail label="Ghi chú" wide>{entry.notes}</Detail>}
          </dl>
        </section>
      </>:<p className={styles.muted}>Chưa có thông tin mục lịch trình.</p>}
    </DetailBody>
  </Modal>
}
