import {useState} from 'react'
import {Button,Panel,RecordFacts} from '@/shared/ui'
import {journeyTime} from '@/shared/lib/journey-time'
import type {DepartureSection} from '../model/preparation'
import type {CruiseDetailView} from '../model/cruise-view'
import {CruisePlanReview} from './CruisePlanReview'
import {DeparturePricingPolicy} from './DeparturePricingPolicy'
import {DepartureScheduleRead} from './DepartureData'
import styles from './DeparturePreparation.module.css'

export function CruisePlanSubmission({detail,refreshKey,onChanged,onPrepare,onSection}:{detail:CruiseDetailView;refreshKey:string;onChanged:()=>void;onPrepare:()=>void;onSection:(section:DepartureSection)=>void}){
 const [showSchedule,setShowSchedule]=useState(false),[showPricing,setShowPricing]=useState(true)
 const cruise=detail.cruise
 return <section className={styles.content} aria-label="Kiểm tra và gửi hồ sơ">
  <div className={styles.sectionIntro}><h2>Kiểm tra và gửi hồ sơ</h2></div>
  <Panel title="Xem lại kế hoạch trước khi gửi">
   <RecordFacts entries={[
    ['Chuyến khởi hành',`${cruise.cruiseCode} · ${cruise.cruiseName}`],['Tàu được phân công',detail.ship?.shipName??'Chưa phân công'],
    ['Khởi hành',journeyTime(cruise.departureDatetime)],['Kết thúc',journeyTime(cruise.returnDatetime)],
    ['Cảng đi',detail.departurePort.portName],['Cảng về',detail.returnPort.portName],
   ]}/>
   <div className={styles.actionGroup}>
    <Button tone="secondary" aria-expanded={showSchedule} aria-controls="review-schedule" onClick={()=>setShowSchedule(value=>!value)}>{showSchedule?'Thu gọn lịch khởi hành':'Xem lịch khởi hành'}</Button>
    <Button tone="secondary" aria-expanded={showPricing} aria-controls="review-pricing" onClick={()=>setShowPricing(value=>!value)}>{showPricing?'Thu gọn chính sách giá':'Xem lại chính sách giá'}</Button>
    <Button tone="text" onClick={onPrepare}>Quay lại chuẩn bị hồ sơ</Button>
   </div>
   <div id="review-schedule">{showSchedule&&<DepartureScheduleRead cruise={cruise} readOnly/>}</div>
  </Panel>
  <div id="review-pricing">{showPricing&&<DeparturePricingPolicy cruiseId={cruise.cruiseId} refreshKey={refreshKey} readOnly/>}</div>
  <CruisePlanReview itineraryMode={cruise.itineraryMode} cruiseId={cruise.cruiseId} refreshKey={refreshKey} onChanged={onChanged} mode="submit" onSection={onSection}/>
 </section>
}
