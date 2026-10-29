import {useState} from 'react'
import {Button,Panel,RecordFacts} from '@/shared/ui'
import {journeyTime} from '@/shared/lib/journey-time'
import type {CruiseDetailView} from '../model/cruise-view'
import {CruisePlanReview} from './CruisePlanReview'
import {DeparturePricingPolicy} from './DeparturePricingPolicy'
import {DepartureScheduleRead} from './DepartureData'
import styles from './DeparturePreparation.module.css'

export function CruisePlanSubmission({detail,refreshKey,onChanged,onPrepare}:{detail:CruiseDetailView;refreshKey:string;onChanged:()=>void;onPrepare:()=>void}){
 const [showSchedule,setShowSchedule]=useState(false),[showPricing,setShowPricing]=useState(false)
 const cruise=detail.cruise
 return <section className={styles.content} aria-label="Bước 3 · Kiểm tra và gửi duyệt">
  <div className={styles.sectionIntro}><h2>Bước 3 · Kiểm tra và gửi duyệt</h2><p>Xem lại kế hoạch của lần khởi hành, sau đó gửi Quản lý vận hành (OPS) phê duyệt. Kết quả xét duyệt được cập nhật tại bước này.</p></div>
  <Panel title="Xem lại kế hoạch trước khi gửi">
   <RecordFacts entries={[
    ['Lần khởi hành',`${cruise.cruiseCode} · ${cruise.cruiseName}`],['Tàu được phân công',detail.ship?.shipName??'Chưa phân công'],
    ['Khởi hành',journeyTime(cruise.departureDatetime)],['Kết thúc',journeyTime(cruise.returnDatetime)],
    ['Cảng đi',detail.departurePort.portName],['Cảng về',detail.returnPort.portName],
   ]}/>
   <div className={styles.actionGroup}>
    <Button tone="secondary" aria-expanded={showSchedule} aria-controls="review-schedule" onClick={()=>setShowSchedule(value=>!value)}>{showSchedule?'Thu gọn lịch và hoạt động':'Xem lại lịch và hoạt động'}</Button>
    <Button tone="secondary" aria-expanded={showPricing} aria-controls="review-pricing" onClick={()=>setShowPricing(value=>!value)}>{showPricing?'Thu gọn chính sách giá':'Xem lại chính sách giá'}</Button>
    <Button tone="text" onClick={onPrepare}>Quay lại bước 2 để chỉnh sửa</Button>
   </div>
   <div id="review-schedule">{showSchedule&&<DepartureScheduleRead cruise={cruise} readOnly/>}</div>
   <div id="review-pricing">{showPricing&&<DeparturePricingPolicy cruiseId={cruise.cruiseId} readOnly/>}</div>
  </Panel>
  <CruisePlanReview cruiseId={cruise.cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="submit"/>
 </section>
}
