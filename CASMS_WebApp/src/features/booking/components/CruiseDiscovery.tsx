import { date, money } from '../model/booking-format'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { bookingApi, bookingCatalog } from '../api/booking-api'
import { useAdapterData } from '../model/booking-state'
import { useBookingDraft } from '../model/booking-context'
import { blankTraveller, parseGuestCount } from '../model/booking-draft'
import type { Cruise } from '../model/booking-types'
import { Action, ActionLink, Badge, EmptyState, FieldInput, Heading, Panel, SampleNotice } from './BookingUI'
import editorial from '../assets/editorial.png'
import hero from '../assets/detail-hero.png'
import cabin from '../assets/cabin.png'
import kayak from '../assets/detail-kayak.png'
import dining from '../assets/dining.png'
import s from './Booking.module.css'
const loadCruises=(signal:AbortSignal)=>bookingApi.listCruises(signal)
export function CruiseSearch() {
 const [params,setParams]=useSearchParams()
 const {data,loading,error,retry}=useAdapterData(loadCruises)
 const [quick,setQuick]=useState<string[]>([])
 const [sort,setSort]=useState('recommended')
 const cruises=(data??[]).filter(c=>(!params.get('destination')||c.title.includes(params.get('destination')!))&&(!params.get('month')||c.departure.startsWith(params.get('month')!))&&(!quick.includes('3–5 ngày')||c.duration>=3)&&(!quick.includes('Ban công')||c.balcony)&&(!quick.includes('Dưới 6 triệu')||c.price<6000000)&&(!quick.includes('Khởi hành tháng 11')||c.departure.startsWith('2026-11')))
 if(sort==='price')cruises.sort((a,b)=>a.price-b.price)
 if(sort==='date')cruises.sort((a,b)=>a.departure.localeCompare(b.departure))
 return <div className={s.surface}><section className={s.searchHero}><div className={s.container}><p className={s.eyebrow}>TÌM CHUYẾN DU THUYỀN</p><h1 className={s.large}>Chọn hành trình hợp với nhịp nghỉ của bạn.</h1><p>Từ vịnh biển yên bình đến trải nghiệm trên tàu, bắt đầu bằng nơi bạn muốn đi và thời gian bạn muốn nghỉ.</p>
 <form className={s.finder} key={params.toString()} onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);setParams(new URLSearchParams([...form.entries()].map(([k,v])=>[k,String(v)])))}}>
 <label>Điểm đến<select name="destination" defaultValue={params.get('destination')??''}><option value="">Hạ Long / Lan Hạ</option>{['Hạ Long','Lan Hạ','Cát Bà'].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Cảng khởi hành<select name="port" defaultValue={params.get('port')??'Tuần Châu'}><option>Tuần Châu</option></select></label>
 <label>Khởi hành<input type="month" name="month" defaultValue={params.get('month')??''}/></label>
 <label>Số khách<select name="guests" defaultValue={params.get('guests')??'2'}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} người lớn</option>)}</select></label><Action type="submit">Tìm chuyến</Action></form></div></section>
 <div className={s.container}><div className={s.between}><Heading level={2} title={cruises.length+' hành trình phù hợp'} description="Giá và chỗ trống được cập nhật lại khi bạn chọn ngày khởi hành."/><label>Sắp xếp<select aria-label="Sắp xếp" value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Đề xuất</option><option value="price">Giá tăng dần</option><option value="date">Ngày khởi hành</option></select></label></div>
 <div className={s.pills}>{['3–5 ngày','Ban công','Dưới 6 triệu','Khởi hành tháng 11'].map(x=><button className={s.pill+' '+(quick.includes(x)?s.active:'')} aria-pressed={quick.includes(x)} key={x} onClick={()=>setQuick(q=>q.includes(x)?q.filter(a=>a!==x):[...q,x])}>{x}</button>)}<button className={s.pill} onClick={()=>{setQuick([]);setParams({});setSort('recommended')}}>Xóa bộ lọc</button></div>
 {loading?<p role="status">Đang tìm hành trình…</p>:error?<EmptyState title={error}><Action onClick={retry}>Thử lại</Action></EmptyState>:!cruises.length?<EmptyState title="Chưa có hành trình phù hợp"><Action onClick={()=>{setQuick([]);setParams({})}}>Xóa bộ lọc</Action></EmptyState>:cruises.map(c=><CruiseCard key={c.id} cruise={c} guests={params.get('guests')??'2'}/>)}
 <section className={s.feature}><img src={editorial} alt="Không gian nghỉ trên boong tàu"/><div><p className={s.eyebrow}>KHÁM PHÁ THEO CÁCH CỦA BẠN</p><h2>Một chuyến đi không chỉ là lịch trình.</h2><p>Cabin, ẩm thực, hoạt động và thời gian nghỉ được kết nối thành một trải nghiệm xuyên suốt.</p><ActionLink to="/#experience">Khám phá trải nghiệm</ActionLink></div></section><SampleNotice/></div></div>
}
function CruiseCard({cruise:c,guests}:{cruise:Cruise;guests:string}) {
 return <article className={s.voyage}><img src={c.image} alt={c.title}/><div><p className={s.eyebrow}>SIGNATURE SAILING</p><h2>{c.title}</h2><p className={s.muted}>{c.ship} · {c.duration} ngày {c.duration-1} đêm</p><p className={s.muted}>{c.route}</p><div className={s.pills}><Badge>{c.available?'Cabin có sẵn · mẫu':'Không còn chỗ'}</Badge><span className={s.pill}>2 trải nghiệm</span></div></div><div><p className={s.eyebrow}>TỪ / KHÁCH</p><strong className={s.price}>{money(c.price)}</strong><p className={s.caption}>Giá minh họa · chưa xác nhận</p>{c.available?<ActionLink to={'/cruises/'+c.id+'?guests='+guests}>Xem hành trình</ActionLink>:<Action disabled>Không khả dụng</Action>}</div></article>
}
export function CruiseDetail() {
 const {cruiseId}=useParams()
 const data=useAdapterData(loadCruises)
 const c=data.data?.find(item=>item.id===cruiseId)
 if(data.loading)return <div className={s.surface}><div className={s.container} role="status">Đang tải hành trình…</div></div>
 if(!c)return <div className={s.surface}><div className={s.container}><EmptyState title={data.error??'Không tìm thấy hành trình'}><ActionLink to="/cruises">Tìm chuyến khác</ActionLink></EmptyState></div></div>
 return <CruiseDetailContent key={c.id} cruise={c}/>
}
function CruiseDetailContent({cruise:c}:{cruise:Cruise}) {
 const {draft,setDraft}=useBookingDraft()
 const [params]=useSearchParams()
 const [guests,setGuests]=useState(String(draft.cruiseId===c.id?draft.travellers.length:parseGuestCount(params.get('guests'))))
 const [category,setCategory]=useState(draft.selectedCabinCategory??'deluxe')
 const navigate=useNavigate()
 const isSignature=c.id==='ha-long-lan-ha'
 function start() {setDraft(d=>({...d,cruiseId:c.id,selectedCabinCategory:category,travellers:Array.from({length:Number(guests)},(_,i)=>d.travellers[i]??blankTraveller()),acceptedTerms:false}));navigate('/booking/travellers')}
 return <div className={s.surface}><section className={s.detailHero}><img src={isSignature?hero:c.image} alt={c.title}/><div><p className={s.eyebrow}>SIGNATURE JOURNEY</p><h1 className={s.large}>{c.title}</h1><p>{c.duration} ngày {c.duration-1} đêm · {c.ship} · Khởi hành {c.port}</p><div className={s.pills}><Badge>{date(c.departure)}</Badge><Badge>{guests} người lớn</Badge><Badge>{category==='deluxe'?'Deluxe':'Balcony'}</Badge></div><p>Từ</p><strong className={s.price}>{money(c.price)} / khách</strong><a className={s.button} href="#plan">Chọn ngày khởi hành</a></div></section>
 <nav className={s.anchorNav} aria-label="Nội dung hành trình">{[['overview','Tổng quan'],['itinerary','Lịch trình'],['cabins','Cabin'],['inclusions','Bao gồm'],['ship','Tàu']].map(([id,label])=><a key={id} href={'#'+id}>{label}</a>)}</nav>
 <div className={s.container}><div className={s.columns}><div className={s.stack}>
 <Panel id="overview"><h2 className={s.editorial}>Vì sao nên chọn hành trình này?</h2><p className={s.muted}>Một nhịp nghỉ cân bằng giữa cảnh quan, hoạt động nhẹ và thời gian thư giãn trên tàu.</p><div className={s.grid4}>{['Hoàng hôn Lan Hạ','Kayak & hang động','Ẩm thực trên vịnh','Cabin hướng biển'].map((x,i)=><div className={s.highlight} key={x}><small>0{i+1}</small>{x}</div>)}</div></Panel>
 <div className={s.gallery}><img src={cabin} alt="Cabin hướng biển"/><img src={kayak} alt="Kayak trên vịnh"/></div>
 <Panel id="itinerary"><h2 className={s.editorial}>Lịch trình</h2>{isSignature?bookingCatalog.itinerary.map(([title,description],i)=><div className={s.day} key={title}><span className={s.eyebrow}>NGÀY {i+1}</span><div><p>{title}</p><p className={s.muted}>{description}</p></div></div>):<p>Lịch trình chi tiết sẽ được cập nhật khi có dữ liệu xác nhận.</p>}</Panel>
 <Panel id="cabins"><h2 className={s.editorial}>Cabin cho hành trình này</h2><p className={s.muted}>Chọn theo không gian, tầm nhìn và cách bạn muốn nghỉ.</p><div className={s.grid2}>{bookingCatalog.cabins.map(item=><div className={s.highlight} key={item.id}><h3>{item.name}</h3><p>{item.area} m² · {item.capacity} khách</p><p>Từ {money(c.price+item.price-4800000)}</p></div>)}</div></Panel>
 <Panel id="inclusions" title="Bao gồm"><p>Quyền lợi theo gói được hiển thị ở bước Cabin & gói. Điều kiện cuối cùng cần được xác nhận trước khi gửi booking.</p></Panel>
 <section id="ship" className={s.feature}><img src={dining} alt="Boong ngắm cảnh"/><div><p className={s.eyebrow}>TRÊN TÀU</p><h2>Khoảng thời gian cũng là một phần của hành trình.</h2><p>Ẩm thực, boong ngắm cảnh và những khoảng lặng được thiết kế để chuyến đi không chỉ là di chuyển.</p></div></section>
 </div><Panel id="plan" title="Lên kế hoạch chuyến đi" className={s.rail}><FieldInput id="departure" label="Ngày khởi hành" value={date(c.departure)} readOnly/><label>Khách<select value={guests} onChange={e=>setGuests(e.target.value)}>{Array.from({length:Math.max(4,Number(guests))},(_,i)=>i+1).map(n=><option value={n} key={n}>{n} người lớn</option>)}</select></label><label>Loại cabin yêu cầu<select value={category} onChange={e=>setCategory(e.target.value)}>{bookingCatalog.cabins.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><p className={s.caption}>Tổng tham khảo</p><strong className={s.price}>{money((c.price+(category==='balcony'?1000000:0))*Number(guests))}</strong><p className={s.caption}>Giá và chỗ trống sẽ được kiểm tra lại trước khi bạn tiếp tục.</p><Action disabled={!c.available} onClick={start}>{c.available?'Tiếp tục đặt chuyến':'Không khả dụng'}</Action><Link to="/cruises">Chọn hành trình khác</Link></Panel></div><SampleNotice/></div></div>
}

