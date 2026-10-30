import {RecordFacts} from '@/shared/ui'
import {domainStatus} from '@/shared/i18n/business-copy'
import {journeyTime,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
const object=(v:unknown):Record<string,unknown>=>v!=null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const rows=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.map(object):[]
const value=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'Chưa thiết lập'
const numeric=(v:unknown)=>typeof v==='number'?Number.isFinite(v)?v:null:typeof v==='string'&&v.trim()&&Number.isFinite(Number(v))?Number(v):null
function money(amount:unknown,currency:unknown){
 const number=numeric(amount)
 if(number==null)return 'Chưa thiết lập'
 if(typeof currency!=='string'||!/^([A-Z]{3})$/.test(currency))return `${number} · Chưa xác định tiền tệ`
 try{return new Intl.NumberFormat('vi-VN',{style:'currency',currency,maximumFractionDigits:4}).format(number)}catch{return `${number} ${currency}`}
}
function clock(instant:unknown,zone:unknown=SHIP_TIME_ZONE){
 if(typeof instant!=='string'||!Number.isFinite(Date.parse(instant)))return 'Chưa thiết lập'
 try{return `${journeyTime(instant,typeof zone==='string'?zone:'UTC')} · ${typeof zone==='string'?zone===SHIP_TIME_ZONE?'Giờ tàu (Việt Nam)':'Giờ cảng':'UTC — chưa xác định múi giờ cảng'}`}
 catch{return `${journeyTime(instant,'UTC')} · UTC — chưa xác định múi giờ cảng`}
}
const percentage=(v:unknown)=>{const number=numeric(v);return number==null?'Chưa thiết lập':new Intl.NumberFormat('vi-VN',{style:'percent',maximumFractionDigits:2}).format(number)}
export function PlanSnapshot({snapshot}:{snapshot:unknown}){
 const s=object(snapshot),c=object(s.cruise),ports=rows(s.ports)
 const portFor=(id:unknown)=>ports.find(port=>port.port_id===id)
 return <>
  <RecordFacts entries={[
   ['Mã lần khởi hành',value(c.cruise_code)],['Tên lần khởi hành',value(c.cruise_name)],
   ['Khởi hành',clock(c.departure_datetime)],['Kết thúc',clock(c.return_datetime)],
   ['Phạm vi',domainStatus('source.scope',String(c.planned_scope))],['Cấu trúc lịch',domainStatus('cruise.itinerary',String(c.itinerary_mode))],
  ]}/>
  <h4>Các lần ghé cảng</h4>
  {rows(s.stops).length?rows(s.stops).map((stop,index)=>{const port=portFor(stop.port_id);return <RecordFacts key={String(stop.cruise_stop_id??index)} entries={[
   ['Thứ tự ghé',value(stop.stop_order)],['Cảng',value(port?.port_name)],
   ['Dự kiến đến',clock(stop.planned_arrival,port?.time_zone_id??null)],['Dự kiến rời',clock(stop.planned_departure,port?.time_zone_id??null)],
   ['Hạn hành khách trở lại tàu',clock(stop.all_aboard_time,port?.time_zone_id??null)],
  ]}/> }):<p>Chưa có lần ghé cảng trong kế hoạch đã gửi.</p>}
  <h4>Hoạt động trên tàu</h4>
  {rows(s.activities).length?rows(s.activities).map((a,index)=><RecordFacts key={String(a.onboard_activity_id??index)} entries={[
   ['Hoạt động',value(a.activity_name)],['Bắt đầu',clock(a.start_time)],['Kết thúc',clock(a.end_time)],['Sức chứa',value(a.capacity)],['Giá',money(a.price,a.currency_code)],
  ]}/>):<p>Chưa có hoạt động trên tàu trong kế hoạch đã gửi.</p>}
  <h4>Tour tham quan trên bờ</h4>
  {rows(s.excursions).length?rows(s.excursions).map((e,index)=>{const stop=rows(s.stops).find(row=>row.cruise_stop_id===e.cruise_stop_id),port=portFor(stop?.port_id);return <RecordFacts key={String(e.shore_excursion_id??index)} entries={[
   ['Tour',value(e.excursion_name)],['Cảng',value(port?.port_name)],['Bắt đầu',clock(e.start_time,port?.time_zone_id??null)],['Dự kiến trở lại tàu',clock(e.planned_return_time,port?.time_zone_id??null)],['Sức chứa tối đa',value(e.maximum_capacity)],['Giá',money(e.price,e.currency_code)],
  ]}/> }):<p>Chưa có tour tham quan trên bờ trong kế hoạch đã gửi.</p>}
  <h4>Khung giờ phục vụ</h4>
  {rows(s.servingWindows).length?rows(s.servingWindows).map((w,index)=><RecordFacts key={String(w.service_schedule_id??index)} entries={[
   ['Dịch vụ',value(rows(s.services).find(service=>service.service_id===w.service_id)?.service_name)],['Bắt đầu',clock(w.starts_at)],['Kết thúc',clock(w.ends_at)],['Địa điểm',value(w.location)],['Sức chứa',value(w.capacity)],
  ]}/>):<p>Chưa có khung giờ phục vụ trong kế hoạch đã gửi.</p>}
  <h4>Gói dịch vụ áp dụng</h4>
  {rows(s.packages).length?rows(s.packages).map((row,index)=>{const p=object(row.package);return <RecordFacts key={String(p.tour_package_id??index)} entries={[["Tên gói",value(p.package_name)],["Giá",money(p.price,p.currency_code)]]}/> }):<p>Chưa gắn gói dịch vụ trong kế hoạch đã gửi.</p>}
  <h4>Chính sách giá đã gửi</h4>
  {rows(s.policy).map((p,index)=><RecordFacts key={String(p.pricing_policy_id??index)} entries={[
   ['Phiên bản',value(p.policy_version)],['Tiền tệ',value(p.currency)],
   ['Phòng trong',money(p.interior_base_fare,p.currency)],['Phòng hướng biển',money(p.ocean_view_base_fare,p.currency)],['Phòng ban công',money(p.balcony_base_fare,p.currency)],['Phòng Suite',money(p.suite_base_fare,p.currency)],
   ['Phí cảng mỗi hành khách',money(p.port_fee_per_passenger,p.currency)],['Thuế suất',percentage(p.tax_rate)],['Tỷ lệ đặt cọc',percentage(p.deposit_percentage)],
   ['Hạn thanh toán cuối trước khởi hành',numeric(p.final_payment_due_days)==null?'Chưa thiết lập':`${p.final_payment_due_days} ngày`],
   ['Hạn thanh toán đủ trước khởi hành',numeric(p.full_payment_cutoff_days)==null?'Chưa thiết lập':`${p.full_payment_cutoff_days} ngày`],['Điều khoản hủy',value(p.cancellation_policy)],
  ]}/>)}
 </>
}
