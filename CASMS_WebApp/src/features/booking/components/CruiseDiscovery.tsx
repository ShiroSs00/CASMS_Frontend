import { date, money } from '../model/booking-format'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { bookingApi, bookingCatalog } from '../api/booking-preview-api'
import { useAdapterData } from '../model/booking-state'
import { useBookingDraft } from '../model/booking-context'
import { blankTraveller, parseGuestCount } from '../model/booking-draft'
import type { Cruise } from '../model/booking-types'
import { Action, ActionLink, Badge, EmptyState, FieldInput, Heading, Panel } from './BookingUI'
import editorial from '../assets/editorial.png'
import hero from '../assets/detail-hero.png'
import cabin from '../assets/cabin.png'
import kayak from '../assets/detail-kayak.png'
import dining from '../assets/dining.png'
import s from './Booking.module.css'
import { LiveCruiseDetail, LiveCruiseSearch } from './LiveCruiseCatalog'
const loadCruises=(signal:AbortSignal)=>bookingApi.listCruises(signal)
export function CruiseSearch() {
 const [params]=useSearchParams()
 if (params.get('catalog')==='live') return <LiveCruiseSearch/>
 return <FixtureCruiseSearch/>
}
function FixtureCruiseSearch() {
 const [params,setParams]=useSearchParams()
 const [quick,setQuick]=useState<string[]>([])
 const [sort,setSort]=useState('recommended')
 const load=useCallback((signal:AbortSignal)=>bookingApi.searchCruises({destination:params.get('destination')??'',port:params.get('port')??'',month:params.get('month')??'',quick,sort},signal),[params,quick,sort])
 const {data,loading,error,retry}=useAdapterData(load)
 const cruises=data?.items??[]
 return <div className={s.surface+' '+s.searchSurface}><section className={s.searchHero}><div className={s.container}><div className={s.searchIntro}><p className={s.eyebrow}>OceVie · HÀNH TRÌNH TRÊN VỊNH</p><h1 className={s.large}>Tìm hành trình dành cho bạn</h1><p>Chọn điểm đến và ngày khởi hành để khám phá những chuyến đi phù hợp với nhịp nghỉ của bạn.</p></div>
 <form className={s.finder} aria-label="Tìm chuyến du thuyền" key={params.toString()} onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);setParams(new URLSearchParams([...form.entries()].map(([k,v])=>[k,String(v)])))}}>
 <label>Điểm đến<select name="destination" defaultValue={params.get('destination')??''}><option value="">Hạ Long / Lan Hạ</option>{['Hạ Long','Lan Hạ','Cát Bà'].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Cảng khởi hành<select name="port" defaultValue={params.get('port')??''}><option value="">Tất cả cảng</option><option>Tuần Châu</option><option>Hòn Gai</option></select></label>
 <label>Khởi hành<input type="month" name="month" defaultValue={params.get('month')??''}/></label>
 <label>Số khách<select name="guests" defaultValue={params.get('guests')??'2'}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} người lớn</option>)}</select></label><Action type="submit">Tìm chuyến</Action></form></div></section>
 <div className={s.container}><div className={s.searchResultsHead}><div><p className={s.eyebrow}>KHÁM PHÁ HÀNH TRÌNH</p><Heading level={2} title={loading?'Đang tìm hành trình…':error?'Chưa tải được hành trình':(data?.totalResults??0)+' hành trình phù hợp'} description="Giá và tình trạng cabin dưới đây là dữ liệu minh họa, cần được xác nhận trước khi đặt chỗ."/></div><label className={s.searchSort}>Sắp xếp<select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Đề xuất</option><option value="price">Giá tăng dần</option><option value="date">Ngày khởi hành</option></select></label></div>
 <div className={s.searchFilters} role="group" aria-label="Bộ lọc nhanh">{['3–5 ngày','Ban công','Dưới 6 triệu','Khởi hành tháng 11'].map(x=><button type="button" className={s.pill+' '+(quick.includes(x)?s.active:'')} aria-pressed={quick.includes(x)} key={x} onClick={()=>setQuick(q=>q.includes(x)?q.filter(a=>a!==x):[...q,x])}>{x}</button>)}<button type="button" className={s.searchClear} onClick={()=>{setQuick([]);setParams({});setSort('recommended')}}>Xóa bộ lọc</button></div>
 <div className={s.searchList} aria-live="polite" aria-busy={loading}>{loading?<p className={s.searchMessage} role="status">Đang tìm hành trình…</p>:error?<EmptyState title={error}><Action onClick={retry}>Thử lại</Action></EmptyState>:!cruises.length?<EmptyState title="Chưa có hành trình phù hợp"><p>Thử thay đổi điểm đến, tháng khởi hành hoặc bộ lọc nhanh.</p><Action onClick={()=>{setQuick([]);setParams({});setSort('recommended')}}>Xóa bộ lọc</Action></EmptyState>:cruises.map(c=><CruiseCard key={c.id} cruise={c} guests={params.get('guests')??'2'}/>)}</div>
 <section className={s.feature}><img src={editorial} alt="Không gian nghỉ trên boong tàu"/><div><p className={s.eyebrow}>KHÁM PHÁ THEO CÁCH CỦA BẠN</p><h2>Một chuyến đi không chỉ là lịch trình.</h2><p>Cabin, ẩm thực, hoạt động và thời gian nghỉ được kết nối thành một trải nghiệm xuyên suốt.</p><ActionLink to="/#experience">Khám phá trải nghiệm</ActionLink></div></section></div></div>
}
function CruiseCard({cruise:c,guests}:{cruise:Cruise;guests:string}) {
 return <article className={s.searchCard}><img src={c.image} alt={c.title}/><div className={s.searchCardBody}><p className={s.eyebrow}>HÀNH TRÌNH OceVie</p><h2>{c.title}</h2><p className={s.searchCardMeta}>{c.ship}<span aria-hidden="true"> · </span>{c.duration} ngày {c.duration-1} đêm</p><p className={s.searchRoute}>{c.route}</p><p className={s.searchDate}>Khởi hành {date(c.departure)}<span aria-hidden="true"> · </span>Từ {c.port}</p><Badge warning={!c.available}>{c.available?'Còn chỗ trong dữ liệu mẫu':'Hết chỗ trong dữ liệu mẫu'}</Badge></div><div className={s.searchCardPrice}><p className={s.eyebrow}>GIÁ THAM KHẢO / KHÁCH</p><strong className={s.price}>{money(c.price)}</strong><p className={s.caption}>Giá và chỗ trống cần xác nhận</p>{c.available?<ActionLink to={'/cruises/'+c.id+'?guests='+guests}>Xem hành trình</ActionLink>:<Action disabled>Không khả dụng</Action>}</div></article>
}
export function CruiseDetail() {
 const [params]=useSearchParams()
 if (params.get('catalog')==='live') return <LiveCruiseDetail/>
 return <FixtureCruiseDetail/>
}
function FixtureCruiseDetail() {
 const {cruiseId}=useParams()
 const data=useAdapterData(loadCruises)
 const c=data.data?.find(item=>item.id===cruiseId)
 if(data.loading)return <div className={s.surface}><div className={s.container} role="status">Đang tải hành trình…</div></div>
 if(data.error)return <div className={s.surface}><div className={s.container}><EmptyState title={data.error}><Action onClick={data.retry}>Thử lại</Action><ActionLink secondary to="/cruises">Tìm chuyến khác</ActionLink></EmptyState></div></div>
 if(!c)return <div className={s.surface}><div className={s.container}><EmptyState title="Không tìm thấy hành trình"><ActionLink to="/cruises">Tìm chuyến khác</ActionLink></EmptyState></div></div>
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
 return <div className={s.surface+' '+s.detailSurface}><section className={s.detailHero}><img src={isSignature?hero:c.image} alt={'Hình minh họa hành trình '+c.title}/><div className={s.detailHeroCopy}><p className={s.eyebrow}>OceVie · HÀNH TRÌNH TRÊN VỊNH</p><h1 className={s.large}>{c.title}</h1><p className={s.detailHeroMeta}>{c.duration} ngày {c.duration-1} đêm <span aria-hidden="true">·</span> {c.ship}</p><p className={s.detailHeroRoute}>{c.route}</p><div className={s.detailHeroFacts}><span>Khởi hành {date(c.departure)}</span><span>Từ cảng {c.port}</span></div><p className={s.detailHeroNote}>Hành trình, giá và tình trạng cabin đang được minh họa; cần xác nhận trước khi đặt chỗ.</p><a className={s.button} href="#plan">Lên kế hoạch chuyến đi</a></div></section>
 <nav className={s.anchorNav} aria-label="Nội dung hành trình">{[['overview','Tổng quan'],['itinerary','Lịch trình'],['cabins','Loại cabin'],['inclusions','Gói trải nghiệm'],['ship','Thông tin tàu']].map(([id,label])=><a key={id} href={'#'+id}>{label}</a>)}</nav>
 <div className={s.container}><div className={s.detailLayout}><div className={s.stack}>
 <Panel id="overview" className={s.detailSection}><p className={s.eyebrow}>TỔNG QUAN</p><h2 className={s.editorial}>Một hành trình để thong thả khám phá</h2><p className={s.muted}>Xem tuyến đi, thời gian và các lựa chọn minh họa trước khi tiếp tục nhập thông tin người đi.</p><div className={s.detailFacts}><div><span>Tàu</span><strong>{c.ship}</strong></div><div><span>Thời gian</span><strong>{c.duration} ngày {c.duration-1} đêm</strong></div><div><span>Khởi hành</span><strong>{date(c.departure)}</strong></div><div><span>Cảng đi</span><strong>{c.port}</strong></div></div></Panel>
 <div className={s.gallery}><img src={cabin} alt="Hình minh họa cabin"/><img src={kayak} alt="Hình minh họa hoạt động kayak"/></div>
 <Panel id="itinerary" className={s.detailSection}><p className={s.eyebrow}>THEO TỪNG NGÀY</p><h2 className={s.editorial}>Lịch trình hành trình</h2>{isSignature?<><p className={s.caption}>Lịch trình minh họa; thời gian và hoạt động cần được xác nhận.</p><div className={s.detailTimeline}>{bookingCatalog.itinerary.map(([title,description],i)=><div className={s.day} key={title}><span className={s.detailDayNumber}>Ngày {i+1}</span><div><h3>{title}</h3><p className={s.muted}>{description}</p></div></div>)}</div></>:<p className={s.muted}>Lịch trình chi tiết chưa có dữ liệu xác nhận cho hành trình này.</p>}</Panel>
 <Panel id="cabins" className={s.detailSection}><p className={s.eyebrow}>KHÔNG GIAN NGHỈ</p><h2 className={s.editorial}>Loại cabin tham khảo</h2><p className={s.muted}>Bạn có thể yêu cầu một loại cabin khi tiếp tục. Cabin cụ thể chỉ được xác nhận sau khi hệ thống phân bổ.</p><div className={s.detailCabins}>{bookingCatalog.cabins.map(item=><div className={s.detailCabin} key={item.id}><h3>{item.name}</h3><p>{item.area} m² <span aria-hidden="true">·</span> Tối đa {item.capacity} khách / cabin</p><p className={s.muted}>{item.description}</p><p className={s.caption}>Giá tham khảo từ {money(c.price+item.price-4800000)} / khách</p></div>)}</div></Panel>
 <Panel id="inclusions" className={s.detailSection}><p className={s.eyebrow}>BAO GỒM & TÙY CHỌN</p><h2 className={s.editorial}>Gói trải nghiệm minh họa</h2><p className={s.muted}>Quyền lợi và giá gói cần được xác nhận trước khi đặt chỗ. Bạn sẽ chọn gói cho từng người ở bước sau.</p><div className={s.detailPackages}>{bookingCatalog.packages.map(item=><div key={item.id}><div><h3>{item.id}</h3><strong>{item.kind==='INCLUDED'?'Đã gồm trong giá tham khảo':`+${money(item.price)} / khách`}</strong></div><p className={s.muted}>{item.description}</p></div>)}</div></Panel>
 <Panel id="ship" className={s.detailSection}><p className={s.eyebrow}>THÔNG TIN TÀU</p><h2 className={s.editorial}>{c.ship}</h2><div className={s.detailShip}><img src={dining} alt="Hình minh họa không gian trên tàu"/><div><p><strong>Tuyến đi:</strong> {c.route}</p><p><strong>Cảng khởi hành:</strong> {c.port}</p><p><strong>Ngày khởi hành:</strong> {date(c.departure)}</p><p className={s.caption}>Hình ảnh minh họa; thông tin tàu và dịch vụ sẽ được xác nhận khi đặt chỗ.</p></div></div></Panel>
 </div><Panel id="plan" className={s.rail+' '+s.detailPlan}><p className={s.eyebrow}>LỰA CHỌN CỦA BẠN</p><h2>Lên kế hoạch chuyến đi</h2><p className={s.muted}>Chọn số khách và loại cabin muốn yêu cầu.</p><FieldInput id="departure" label="Ngày khởi hành" value={date(c.departure)} readOnly/><label>Số khách<select value={guests} onChange={e=>setGuests(e.target.value)}>{Array.from({length:Math.max(4,Number(guests))},(_,i)=>i+1).map(n=><option value={n} key={n}>{n} người lớn</option>)}</select></label><label>Loại cabin yêu cầu<select value={category} onChange={e=>setCategory(e.target.value)}>{bookingCatalog.cabins.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><p className={s.caption}>Loại đã chọn là yêu cầu, chưa phải cabin được phân bổ.</p><div className={s.detailTotal}><span>Tổng giá tham khảo cho {guests} khách</span><strong className={s.price}>{money((c.price+(category==='balcony'?1000000:0))*Number(guests))}</strong><small>Giá và chỗ trống là dữ liệu mẫu, chưa được xác nhận.</small></div><Action disabled={!c.available} onClick={start}>{c.available?'Tiếp tục nhập thông tin người đi':'Không khả dụng trong dữ liệu mẫu'}</Action><Link to="/cruises">Chọn hành trình khác</Link></Panel></div></div></div>
}

