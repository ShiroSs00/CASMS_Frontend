import {RecordFacts} from '@/shared/ui'
import {businessCopy,domainStatus} from '@/shared/i18n/business-copy'
const object=(v:unknown):Record<string,unknown>=>v!=null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const rows=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.map(object):[]
const value=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'Chưa thiết lập'
export function PlanSnapshot({snapshot}:{snapshot:unknown}){
 const s=object(snapshot),c=object(s.cruise),ports=rows(s.ports)
 const groups=[['activities','Hoạt động trên tàu',['activity_name','start_time','end_time','capacity','price','currency_code']],['excursions',businessCopy('program.SHORE_EXCURSION'),['excursion_name','start_time','planned_return_time','maximum_capacity','price','currency_code']],['servingWindows',businessCopy('program.SERVING_WINDOW'),['starts_at','ends_at','location','capacity']]] as const
 const labels:Record<string,string>={activity_name:'Tên hoạt động',excursion_name:'Tên tour',start_time:'Bắt đầu',end_time:'Kết thúc',planned_return_time:'Về tàu dự kiến',capacity:'Sức chứa',maximum_capacity:'Sức chứa tối đa',price:'Giá',currency_code:'Tiền tệ',starts_at:'Bắt đầu',ends_at:'Kết thúc',location:'Địa điểm'}
 return <><RecordFacts entries={[
  ['Mã lần khởi hành',value(c.cruise_code)],['Tên lần khởi hành',value(c.cruise_name)],['Khởi hành',value(c.departure_datetime)],['Kết thúc',value(c.return_datetime)],['Phạm vi',domainStatus('source.scope',String(c.planned_scope))],['Cấu trúc lịch',domainStatus('cruise.itinerary',String(c.itinerary_mode))],
 ]}/><h4>Ngày và lần ghé cảng</h4>{rows(s.stops).map((stop,index)=><RecordFacts key={index} entries={[
  ['Lần ghé',value(stop.stop_order)],['Cảng',value(ports.find(p=>p.port_id===stop.port_id)?.port_name)],['Dự kiến đến',value(stop.planned_arrival)],['Dự kiến rời',value(stop.planned_departure)],['Hạn lên tàu',value(stop.all_aboard_time)],
 ]}/>)}
 {groups.map(([key,title,fields])=><section key={key}><h4>{title}</h4>{rows(s[key]).length?rows(s[key]).map((row,index)=><RecordFacts key={index} entries={fields.map(f=>[labels[f],value(row[f])])}/>):<p>Không có dữ liệu trong kế hoạch đã gửi.</p>}</section>)}
 <h4>Gói dịch vụ chuyến đi</h4>{rows(s.packages).map((row,index)=>{const p=object(row.package);return <RecordFacts key={index} entries={[["Tên gói",value(p.package_name)],["Giá",value(p.price)],["Tiền tệ",value(p.currency_code)]]}/>})}
 <h4>Chính sách giá trong kế hoạch</h4>{rows(s.policy).map((p,index)=><RecordFacts key={index} entries={[
 ['Phiên bản',value(p.policy_version)],['Tiền tệ',value(p.currency)],['Phòng trong',value(p.interior_base_fare)],['Phòng hướng biển',value(p.ocean_view_base_fare)],['Phòng ban công',value(p.balcony_base_fare)],['Suite',value(p.suite_base_fare)],['Phí cảng',value(p.port_fee_per_passenger)],['Thuế suất',value(p.tax_rate)],['Tỷ lệ đặt cọc',value(p.deposit_percentage)],['Điều khoản hủy',value(p.cancellation_policy)],
 ]}/>)}</>
}
