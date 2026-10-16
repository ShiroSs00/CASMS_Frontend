import { date, money } from '../model/booking-format'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { bookingApi } from '../api/booking-api'
import { useAdapterData } from '../model/booking-state'
import type { Booking, Cruise } from '../model/booking-types'
import { Action, ActionLink, Badge, EmptyState, Heading, Panel, SampleNotice } from './BookingUI'
import { TravellerDocuments, OnlineCheckin, ArrivalTime, BoardingPass } from './PreCruise'
import { PaymentContract, ChangeRequest } from './BookingTransactions'
import bookingShip from '../assets/booking-ship.png'
import bookingKayak from '../assets/booking-kayak.png'
import manageImage from '../assets/manage.png'
import s from './Booking.module.css'
const loadData=async(signal:AbortSignal)=>({bookings:await bookingApi.listBookings(signal),cruises:await bookingApi.listCruises(signal)})
export type ManagementView='detail'|'manage'|'travellers'|'check-in'|'arrival-time'|'boarding-pass'|'payment'|'change-request'
const managementLink=(id:string,path='')=>'/my-bookings/'+id+(path?'/'+path:'')+'?preview=1'
export function BookingManagement({view}:{view?:ManagementView}) {
 const [params,setParams]=useSearchParams()
 const {bookingId}=useParams()
 const data=useAdapterData(loadData)
 if(params.get('preview')!=='1')return <div className={s.surface+' '+s.white}><div className={s.container}><Heading title="Booking của tôi" description="Theo dõi hành trình, thanh toán và yêu cầu thay đổi tại một nơi."/><EmptyState title="Dữ liệu booking chưa khả dụng"><p>Dịch vụ booking chưa được kết nối. Chưa thể tải booking của tài khoản này.</p><Action secondary onClick={()=>setParams({preview:'1'})}>Xem giao diện với dữ liệu minh họa</Action><ActionLink to="/cruises">Khám phá hành trình</ActionLink></EmptyState></div></div>
 if(data.loading)return <div className={s.surface}><div className={s.container} role="status">Đang tải bản xem trước…</div></div>
 if(data.error)return <div className={s.surface}><div className={s.container}><EmptyState title={data.error}><Action onClick={data.retry}>Thử lại</Action></EmptyState></div></div>
 const booking=data.data?.bookings.find(b=>b.id===bookingId)
 const cruise=data.data?.cruises.find(c=>c.id===booking?.cruiseId)
 if(view&&(!booking||!cruise))return <div className={s.surface}><div className={s.container}><EmptyState title="Không tìm thấy booking minh họa"><ActionLink to="/my-bookings?preview=1">Về danh sách</ActionLink></EmptyState></div></div>
 return <div className={s.surface+' '+s.white}><div className={s.container}>{!view?<BookingList bookings={data.data?.bookings??[]} cruises={data.data?.cruises??[]}/>:booking&&cruise?<>{view==='detail'?<BookingDetail booking={booking} cruise={cruise}/>:view==='manage'?<ManageHub booking={booking} cruise={cruise}/>:view==='travellers'?<TravellerDocuments key={booking.id} booking={booking}/>:view==='check-in'?<OnlineCheckin key={booking.id} booking={booking}/>:view==='arrival-time'?<ArrivalTime key={booking.id} booking={booking} cruise={cruise}/>:view==='boarding-pass'?<BoardingPass booking={booking} cruise={cruise}/>:view==='payment'?<PaymentContract booking={booking} cruise={cruise}/>:<ChangeRequest booking={booking} cruise={cruise}/>}<nav className={s.pills} aria-label="Điều hướng booking"><Link className={s.taskLink} to="/my-bookings?preview=1">← Booking của tôi</Link>{view!=='manage'&&<Link className={s.taskLink} to={managementLink(booking.id,'manage')}>Chuẩn bị trước chuyến →</Link>}</nav></>:null}<SampleNotice/></div></div>
}
function BookingList({bookings,cruises}:{bookings:Booking[];cruises:Cruise[]}) {
 const [filter,setFilter]=useState('upcoming')
 const [now]=useState(Date.now)
 const shown=bookings.filter(b=>filter==='pending'?b.status==='Draft':filter==='past'?new Date(cruises.find(c=>c.id===b.cruiseId)!.end).getTime()<now:b.status!=='Cancelled'&&new Date(cruises.find(c=>c.id===b.cruiseId)!.end).getTime()>=now)
 return <><div className={s.between}><Heading title="Booking của tôi" description="Theo dõi hành trình, thanh toán và yêu cầu thay đổi tại một nơi."/><ActionLink to="/reservation-lookup" secondary>Tìm booking</ActionLink></div><div className={s.pills}>{[['upcoming','Sắp tới'],['pending','Chờ xử lý'],['past','Đã hoàn tất']].map(([id,label])=><button key={id} className={s.pill+' '+(filter===id?s.selected:'')} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>{shown.length?shown.map(b=>{const c=cruises.find(x=>x.id===b.cruiseId)!;return <article className={s.voyage+' '+s.bookingCard} key={b.id}><img src={b.cruiseId==='ha-long-lan-ha'?bookingShip:bookingKayak} alt={c.title}/><div><Badge warning={b.status!=='Confirmed'}>{b.status.toUpperCase()}</Badge><h2>{c.title}</h2><p className={s.muted}>{date(c.departure)} – {date(c.end)} · {c.ship}</p><p className={s.muted}>{b.requestedCategory} · {b.packageName}</p></div><div><p className={s.caption}>Tổng</p><h2>{money(b.fare)}</h2><ActionLink to={managementLink(b.id)}>{b.status==='Confirmed'?'Tiếp tục':'Xem chi tiết'}</ActionLink></div></article>}):<EmptyState title="Chưa có booking trong nhóm này"><Action onClick={()=>setFilter('upcoming')}>Xem booking sắp tới</Action></EmptyState>}</>
}
function BookingDetail({booking:b,cruise:c}:{booking:Booking;cruise:Cruise}) {
 return <><div className={s.between}><Heading large title={c.title} description={b.reference+' · '+date(c.departure)+' – '+date(c.end)}/><Badge>{b.status.toUpperCase()}</Badge></div><div className={s.columns}><div className={s.stack}><Panel title="Hành trình"><p>{c.ship} · {c.route}</p><p className={s.muted}>Loại cabin yêu cầu: {b.requestedCategory} · Gói: {b.packageName}</p><p className={s.caption}>{b.assignedCabin?'Cabin được phân bổ: '+b.assignedCabin:'Chưa có thông tin cabin được phân bổ.'}</p></Panel><Panel title="Hành khách"><p>{b.passengers.map(p=>p.name).join(' · ')}</p><p className={s.muted}>{b.passengers.filter(p=>!p.documentReady).length} hành khách còn thiếu giấy tờ đi lại</p></Panel><Panel title="Before you sail"><p>{b.preparationDone}/5 việc đã hoàn tất · Giờ đến {b.arrival??'chưa chọn'}</p><Link className={s.taskLink} to={managementLink(b.id,'manage')}>Tiếp tục chuẩn bị →</Link></Panel></div><Panel title="Tổng booking"><strong className={s.price}>{money(b.fare)}</strong><Badge warning={b.payment!=='Confirmed'}>{b.payment==='Confirmed'?'Đã thanh toán':'Thanh toán: '+b.payment}</Badge><ActionLink to={managementLink(b.id,'manage')}>Chuẩn bị trước chuyến</ActionLink><ActionLink secondary to={managementLink(b.id,'travellers')}>Quản lý khách</ActionLink><ActionLink secondary to={managementLink(b.id,'change-request')}>Yêu cầu thay đổi / hủy</ActionLink><p className={s.caption}>Khả năng chỉnh sửa phụ thuộc điều kiện nghiệp vụ và hợp đồng áp dụng.</p></Panel></div></>
}
function ManageHub({booking:b,cruise:c}:{booking:Booking;cruise:Cruise}) {
 const tasks=[
 ['payment','Thanh toán',b.payment==='Confirmed'?'Hoàn tất':'Chờ thanh toán',b.payment==='Confirmed'?'Số dư hiện tại đã được thanh toán.':'Xem trạng thái và số tiền cần thanh toán.','Xem chi tiết'],
 ['travellers','Thông tin khách','Cần bổ sung',b.passengers.length+' hành khách đã có thông tin cơ bản.','Bổ sung giấy tờ'],
 ['check-in','Online check-in','Đang chuẩn bị','Theo dõi từng bước của mỗi hành khách.','Tiếp tục check-in'],
 ['arrival-time','Giờ đến cảng',b.arrival??'Chưa chọn','Chọn thời gian đến để giảm thời gian chờ.','Chọn khung giờ'],
 ['boarding-pass','Boarding pass','Chưa sẵn sàng','Cần được hệ thống xác nhận đủ điều kiện.','Xem yêu cầu'],
 ['change-request','Yêu cầu thay đổi','Tùy điều kiện','Xem điều kiện thay đổi hoặc hủy booking.','Quản lý booking'],
 ]
 const [now]=useState(Date.now)
 const days=Math.max(0,Math.ceil((new Date(c.departure+'T00:00:00+07:00').getTime()-now)/86400000))
 return <><section className={s.manageHero}><img src={manageImage} alt={c.title}/><div className={s.stack}><p className={s.eyebrow}>SẮP KHỞI HÀNH</p><h1 className={s.large}>{c.title}</h1><p>{c.ship} · {date(c.departure)} – {date(c.end)} · {c.duration} ngày {c.duration-1} đêm</p><div className={s.pills}><Badge>{b.status.toUpperCase()}</Badge><span className={s.pill}>{days} ngày nữa</span></div><p className={s.muted}>Mã booking {b.reference}</p></div></section><Panel><div className={s.between}><h2>Chuẩn bị trước chuyến</h2><p>{b.preparationDone} / 5 việc đã hoàn tất</p></div><progress className={s.progress} max={5} value={b.preparationDone} aria-label="Tiến độ chuẩn bị"/></Panel><div className={s.tasks}>{tasks.map(([path,title,status,description,cta])=><Panel key={path}><div className={s.between}><h3>{title}</h3><Badge warning={path==='travellers'||path==='arrival-time'}>{status}</Badge></div><p className={s.muted}>{description}</p><Link className={s.taskLink} to={managementLink(b.id,path)}>{cta} →</Link></Panel>)}</div></>
}

