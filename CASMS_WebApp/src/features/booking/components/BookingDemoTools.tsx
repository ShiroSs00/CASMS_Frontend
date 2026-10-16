import { Link, useLocation } from 'react-router'
import { useBookingDraft } from '../model/booking-context'
import type { BookingScenario } from '../model/booking-scenarios'
import { defaultScenario } from '../model/booking-scenarios'
import s from './Booking.module.css'

// A separate preview boundary, deliberately outside the design's page content.
export function BookingDemoTools() {
 const {pathname}=useLocation()
 const {draft,scenario,setScenario}=useBookingDraft()
 if(!/^\/(?:$|cruises(?:\/|$)|booking(?:\/|$)|my-bookings(?:\/|$))/.test(pathname))return null
 function choose<K extends keyof BookingScenario>(key:K,value:BookingScenario[K]) {setScenario(old=>({...old,[key]:value}))}
 return <aside className={s.demoTools} aria-label="Môi trường mô phỏng">
  <details><summary>DEMO · Dữ liệu mô phỏng</summary><div>
   <p>Chuyến, chỗ trống và booking là dữ liệu mẫu. Chưa kết nối dịch vụ đặt chỗ.</p>
   {import.meta.env.DEV&&<>
    <label>Phản hồi mô phỏng<select value={scenario.action} onChange={e=>choose('action',e.target.value as BookingScenario['action'])}>{['missing','received','validation','conflict','network-error','unknown','no-access','expired'].map(x=><option key={x}>{x}</option>)}</select></label>
    <button disabled={!draft.selectedCabinCategory} onClick={()=>choose('unavailableCategory',draft.selectedCabinCategory)}>Mô phỏng cabin đang chọn hết chỗ</button>
    <label>Thanh toán mẫu<select value={scenario.payment} onChange={e=>choose('payment',e.target.value as BookingScenario['payment'])}>{['fixture','Pending','Confirmed','Failed','Cancelled'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Check-in mẫu<select value={scenario.checkin} onChange={e=>choose('checkin',e.target.value as BookingScenario['checkin'])}>{['fixture','NotStarted','InProgress','NeedsReview','Completed','BoardingReady'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Tiến độ yêu cầu mẫu<select value={scenario.requestStage} onChange={e=>choose('requestStage',e.target.value as BookingScenario['requestStage'])}>{['not-submitted','received','under-review','decision'].map(x=><option key={x}>{x}</option>)}</select></label>
    <button onClick={()=>setScenario(defaultScenario)}>Đặt lại kịch bản</button>
    <Link to="/my-bookings?preview=1">Mở tài khoản mẫu</Link>
   </>}
  </div></details>
 </aside>
}
