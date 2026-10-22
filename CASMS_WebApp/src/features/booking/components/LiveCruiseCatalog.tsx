import { useCallback } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { catalogReturn } from '../model/live-booking-navigation'
import { bookingReadFailure } from '../model/booking-feedback'
import { ApiError } from '@/shared/api'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LiveCruise, LiveCruisePage } from '../api/live-cruise-contract'
import type { ItineraryLookup, LiveItineraryDay, LivePortCall, LiveShip } from '../api/live-itinerary-contract'
import { useAdapterData } from '../model/booking-state'
import { Action, ActionLink, EmptyState, Heading } from './BookingUI'
const hero = '/images/ports/singapore-marina-bay.webp'
import s from './Booking.module.css'

type LoadIssue = { message: string; status: number }
type LoadResult<T> = { value?: T; issue?: LoadIssue }

function issueFor(error: unknown): LoadIssue {
  if (error instanceof ApiError) {
    if (error.status === 401) return { status:401, message:`Cần đăng nhập để xem thông tin này.` }
    if (error.status === 403) return { status:403, message:`Bạn chưa được phép xem thông tin này. Vui lòng liên hệ bộ phận hỗ trợ.` }
    return { status:error.status, message:bookingReadFailure(error.status) }
  }
  return { status:0, message:error instanceof Error ? error.message : 'Không tải được thông tin chuyến đi.' }
}

type Resource<T> = { value?:T; issue?:LoadIssue; missing?:boolean }
async function capture<T>(load:()=>Promise<T>):Promise<Resource<T>> {
  try { return {value:await load()} } catch(error) { return {issue:issueFor(error)} }
}

const vietnamTime = new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Ho_Chi_Minh' })
const when = (instant:string) => vietnamTime.format(new Date(instant))
const route = (cruise:LiveCruise) => [cruise.departurePort,cruise.returnPort].filter(Boolean).join(' → ') || 'Chưa có thông tin cảng'
const liveDetailLink = (id:string) => `/cruises/${encodeURIComponent(id)}`
const statusNames:Record<string,string> = {DRAFT:'Bản nháp',PENDING_APPROVAL:'Chờ duyệt',APPROVED:'Đã duyệt',OPEN_FOR_SALE:'Mở bán',ACTIVE:'Đang hoạt động',COMPLETED:'Đã hoàn tất',REJECTED:'Bị từ chối',SUSPENDED:'Tạm dừng',CANCELLED:'Đã hủy',MAINTENANCE:'Bảo trì',INACTIVE:'Không hoạt động',PLANNED:'Dự kiến',DELAYED:'Bị trễ',OMITTED:'Đã bỏ qua',SUBSTITUTED:'Đã thay thế'}
const statusName = (value:string) => statusNames[value]??value

function LiveError({issue,retry}:{issue:LoadIssue;retry:()=>void}) {
  const location=useLocation()
  return <div role="alert"><EmptyState title="Không tải được danh mục chuyến đi"><p>{issue.message}</p><Action onClick={retry}>Thử lại</Action>{issue.status===401&&<ActionLink secondary to={'/login?returnTo='+encodeURIComponent(location.pathname+location.search)}>Đăng nhập</ActionLink>}</EmptyState></div>
}

export function LiveCruiseSearch() {
  const [params]=useSearchParams()
  const requested=Number(params.get('page')??'1')
  const page=Number.isSafeInteger(requested)&&requested>0?requested:1
  const rawType=params.get('cruiseType')
  const cruiseType=rawType==='ONE_DAY'||rawType==='MULTI_DAYS'?rawType:undefined
  return <LiveCruiseSearchPage key={`${page}:${cruiseType}`} page={page} cruiseType={cruiseType}/>
}

function LiveCruiseSearchPage({page,cruiseType}:{page:number;cruiseType?:'ONE_DAY'|'MULTI_DAYS'}) {
  const [params,setParams]=useSearchParams()
  const location=useLocation()
  const pageLink=(next:number)=>{const query=new URLSearchParams(params);query.set('page',String(next));return '/cruises?'+query}
  const load=useCallback(async(signal:AbortSignal):Promise<LoadResult<LiveCruisePage>>=>{
    try { return { value:await liveCruiseCatalogApi.list(page,signal,cruiseType) } }
    catch(error) { return { issue:issueFor(error) } }
  },[page,cruiseType])
  const {data,loading,error,retry}=useAdapterData(load)
  const result=data?.value
  const issue=data?.issue??(error?{status:0,message:error}:undefined)
  return <div className={s.surface+' '+s.searchSurface+' '+s.liveSurface}>
    <section className={s.searchHero}><div className={s.container}><div className={s.searchIntro}><p className={s.eyebrow}>KHÁM PHÁ HẢI TRÌNH</p><h1>Hành trình đã công bố</h1><p>Khám phá hành trình đã công bố và lựa chọn phòng phù hợp.</p></div></div></section>
    <div className={s.container}>
      <div className={s.liveModeNotice}><strong>Chuyến du lịch đã công bố</strong><span>Chọn chuyến để xem lịch trình và các phòng còn trống.</span><Link to="/booking/lookup">Tra cứu đặt chỗ</Link></div>
      <div className={s.searchResultsHead}><div><p className={s.eyebrow}>HÀNH TRÌNH SẮP TỚI</p><Heading level={2} title={loading?'Đang tải hành trình…':issue?'Chưa tải được danh mục':`${result?.total??0} hành trình đã công bố`} description="Chọn hành trình để xem lịch trình, phòng còn trống và bắt đầu đặt chỗ."/></div></div>
      <div className={s.liveFilterBar}><label className={s.liveFilter}><span id="catalog-cruise-type-label">Loại hành trình</span><select aria-labelledby="catalog-cruise-type-label" value={cruiseType??''} onChange={event=>{const query=new URLSearchParams(params);query.delete('page');if(event.target.value)query.set('cruiseType',event.target.value);else query.delete('cruiseType');setParams(query)}}><option value="">Tất cả</option><option value="ONE_DAY">Chuyến trong ngày</option><option value="MULTI_DAYS">Chuyến nhiều ngày</option></select></label><p>Sắp xếp theo ngày khởi hành sớm nhất · Giờ Việt Nam</p>{cruiseType && <Action onClick={()=>{const query=new URLSearchParams(params);query.delete('cruiseType');query.delete('page');setParams(query)}}>Xóa bộ lọc</Action>}</div>
      <div className={s.searchList} aria-live="polite" aria-busy={loading}>
        {loading?<p className={s.searchMessage} role="status">Đang tải hành trình…</p>
          :issue?<LiveError issue={issue} retry={retry}/>
          :result?.items.length?result.items.map(cruise=><LiveCruiseCard key={cruise.id} cruise={cruise} from={location.pathname+location.search}/>)
            :<EmptyState title={result?.total?'Trang này không có hành trình':'Chưa có hành trình đã công bố'}><p>{cruiseType ? 'Chưa có chuyến phù hợp với loại hành trình đang chọn. Bạn có thể xóa bộ lọc để xem tất cả.' : 'Hiện chưa có chuyến đã công bố trong trang này. Vui lòng quay lại sau.'}</p>{page>1&&<ActionLink to={pageLink(1)}>Về trang đầu</ActionLink>}</EmptyState>}
      </div>
      {result&&result.total>0&&result.page<=result.pageCount&&<nav className={s.livePagination} aria-label="Phân trang danh mục cruise"><span>Trang {result.page} / {result.pageCount} · {result.total} hành trình</span><div>{result.page>1?<Link to={pageLink(result.page-1)}>← Trang trước</Link>:<span aria-disabled="true">← Trang trước</span>}{result.page<result.pageCount?<Link to={pageLink(result.page+1)}>Trang sau →</Link>:<span aria-disabled="true">Trang sau →</span>}</div></nav>}
    </div>
  </div>
}

function LiveCruiseCard({cruise,from}:{cruise:LiveCruise;from:string}) {
  return <article className={s.searchCard+' '+s.liveCard} aria-labelledby={'cruise-'+cruise.id}><div className={s.liveImage}><img src={hero} alt="Cảng Marina Bay, Singapore"/></div><div className={s.searchCardBody}><p className={s.eyebrow}>HẢI TRÌNH ĐÃ CÔNG BỐ</p><h2 id={'cruise-'+cruise.id}><Link to={liveDetailLink(cruise.id)+'?from='+encodeURIComponent(from)}>{cruise.title}</Link></h2><p className={s.searchCardMeta}>{cruise.code&&`${cruise.code} · `}{cruise.ship??'Chưa có tên tàu'}</p><p className={s.searchRoute}>{route(cruise)}</p><p className={s.searchDate}>Khởi hành: {when(cruise.departure)} · Giờ Việt Nam</p><p className={s.searchDate}>Trở về: {when(cruise.returnAt)} · Giờ Việt Nam</p></div><div className={s.searchCardPrice+' '+s.liveCardAside}><p className={s.eyebrow}>GIÁ & CABIN</p><strong>Chọn phòng theo chuyến</strong><p>Xem phòng trống khi đặt chỗ; giá và hợp đồng được xác định sau khi gửi.</p><ActionLink to={liveDetailLink(cruise.id)+'?from='+encodeURIComponent(from)}>Xem hành trình</ActionLink></div></article>
}

export function LiveCruiseDetail() {
  const {cruiseId}=useParams()
  const [params]=useSearchParams()
  const back=catalogReturn(params.get('from'))
  const load=useCallback(async(signal:AbortSignal):Promise<LoadResult<LiveCruise|null>>=>{
    try { return { value:cruiseId?await liveCruiseCatalogApi.detail(cruiseId,signal):null } }
    catch(error) { return { issue:issueFor(error) } }
  },[cruiseId])
  const {data,loading,error,retry}=useAdapterData(load)
  const issue=data?.issue??(error?{status:0,message:error}:undefined)
  const cruise=data?.value
  if(loading)return <div className={s.surface+' '+s.liveSurface}><div className={s.container}><p className={s.searchMessage} role="status">Đang tải chi tiết hành trình…</p></div></div>
  if(issue)return <div className={s.surface+' '+s.liveSurface}><div className={s.container}><LiveError issue={issue} retry={retry}/><ActionLink secondary to={back}>Về danh mục</ActionLink></div></div>
  if(!cruise)return <div className={s.surface+' '+s.liveSurface}><div className={s.container}><EmptyState title="Không có hành trình đã công bố"><p>Chuyến này chưa được công bố hoặc không còn trong danh mục.</p><ActionLink to={back}>Về danh mục</ActionLink></EmptyState></div></div>
  return <div className={s.surface+' '+s.liveSurface}><section className={s.liveDetailHero}><img src={hero} alt="Cảng Marina Bay, Singapore"/><div><p className={s.eyebrow}>HẢI TRÌNH ĐÃ CÔNG BỐ</p><h1>{cruise.title}</h1><p>{cruise.code&&`${cruise.code} · `}{cruise.ship??'Chưa có tên tàu'}</p><p>{route(cruise)}</p></div></section><div className={s.container}><div className={s.liveModeNotice}><strong>Hành trình của bạn</strong><span>Chọn phòng và cung cấp thông tin hành khách ở bước đặt chỗ.</span><Link to={back}>← Về danh mục</Link></div><nav className={s.liveAnchors} aria-label="Nội dung hành trình"><a href="#cruise-facts">Thời gian & cảng</a><a href="#cruise-extras">Lịch trình & tàu</a></nav><div className={s.liveDetailGrid}><section id="cruise-facts" className={s.liveInfoPanel}><p className={s.eyebrow}>THỜI GIAN & CẢNG</p><h2>Thông tin hành trình</h2><dl><div><dt>Khởi hành</dt><dd>{when(cruise.departure)} · Giờ Việt Nam</dd></div><div><dt>Trở về</dt><dd>{when(cruise.returnAt)} · Giờ Việt Nam</dd></div><div><dt>Cảng đi</dt><dd>{cruise.departurePort??'Chưa có dữ liệu'}</dd></div><div><dt>Cảng về</dt><dd>{cruise.returnPort??'Chưa có dữ liệu'}</dd></div><div><dt>Tàu</dt><dd>{cruise.ship??'Chưa có dữ liệu'}</dd></div></dl><p>Các ngày và điểm dừng được hiển thị riêng bên dưới khi đã có lịch trình.</p></section><aside className={s.liveInfoPanel}><p className={s.eyebrow}>ĐẶT CHỖ</p><h2>Lên kế hoạch chuyến đi</h2><p>Xem phòng còn trống theo chuyến và nhập thông tin hành khách. Giá, cọc và hướng dẫn hợp đồng sẽ được tính khi đặt chỗ.</p><ActionLink to={`/booking/cabin-experience?cruiseId=${encodeURIComponent(cruise.id)}&from=${encodeURIComponent(back)}`}>Chọn phòng & đặt chỗ</ActionLink><ActionLink secondary to={back}>Xem hành trình khác</ActionLink></aside></div><section id="cruise-extras" aria-label="Lịch trình và tàu"><LiveCruiseExtendedDetails cruise={cruise}/></section></div></div>
}

function ExtraIssue({issue,retry}:{issue:LoadIssue;retry:()=>void}) {
  const location=useLocation()
  return <div role="alert"><p>{issue.message}</p><Action onClick={retry}>Thử lại</Action>{issue.status===401&&<ActionLink secondary to={`/login?returnTo=${encodeURIComponent(location.pathname+location.search)}`}>Đăng nhập</ActionLink>}</div>
}

function LiveCruiseExtendedDetails({cruise}:{cruise:LiveCruise}) {
  const load=useCallback(async(signal:AbortSignal)=>{
    const shipId=cruise.shipId
    const [ship,itinerary]=await Promise.all([
      shipId?capture(()=>liveCruiseCatalogApi.ship(shipId,signal)):Promise.resolve({missing:true} as Resource<LiveShip>),
      capture(()=>liveCruiseCatalogApi.itinerary(cruise.id,signal)),
    ])
    let days:Resource<LiveItineraryDay[]>|undefined
    let stops:Resource<LivePortCall[]>|undefined
    if (itinerary.value?.kind==='found') {
      const id=itinerary.value.itinerary.id
      const resources=await Promise.all([
        capture(()=>liveCruiseCatalogApi.days(id,signal)),
        capture(()=>liveCruiseCatalogApi.stops(id,signal)),
      ])
      days=resources[0]
      stops=resources[1]
    }
    return {ship,itinerary,days,stops}
  },[cruise.id,cruise.shipId])
  const {data,loading,error,retry}=useAdapterData(load)
  const lookup=data?.itinerary.value as ItineraryLookup|undefined
  return <div className={s.liveDetailGrid} aria-live="polite" aria-busy={loading}>
    <div className={s.stack}>
      <section className={s.liveInfoPanel} aria-labelledby="live-itinerary-heading"><p className={s.eyebrow}>LỊCH TRÌNH CHUYẾN ĐI</p><h2 id="live-itinerary-heading">Lịch trình liên kết</h2>
        {loading?<p role="status">Đang tra cứu lịch trình theo mã chuyến đi…</p>:error?<ExtraIssue issue={{status:0,message:error}} retry={retry}/>:data?.itinerary.issue?<ExtraIssue issue={data.itinerary.issue} retry={retry}/>:lookup?.kind==='limit'?<p>Đã kiểm tra {lookup.pagesScanned}/{lookup.totalPages} trang. Chưa thể xác định lịch trình của chuyến này trong giới hạn tra cứu.</p>:lookup?.kind==='missing'?<p>Không tìm thấy lịch trình liên kết theo mã chuyến đi trong danh sách hiện có.</p>:lookup?.kind==='found'?<><p><strong>{lookup.itinerary.name??'Lịch trình chưa có tên'}</strong></p><p>Trạng thái: {lookup.itinerary.status?statusName(lookup.itinerary.status):'Chưa có dữ liệu'}</p>{lookup.itinerary.startDate&&<p>Từ {lookup.itinerary.startDate}{lookup.itinerary.endDate&&` đến ${lookup.itinerary.endDate}`}</p>}</>:null}
      </section>
      {lookup?.kind==='found'&&<><section className={s.liveInfoPanel} aria-labelledby="live-days-heading"><p className={s.eyebrow}>THEO TỪNG NGÀY</p><h2 id="live-days-heading">Các ngày trong lịch trình</h2>{data?.days?.issue?<ExtraIssue issue={data.days.issue} retry={retry}/>:data?.days?.value?.length?<ol>{data.days.value.map(day=><li key={day.id}><strong>Ngày {day.number}{day.date&&` · ${day.date}`}</strong>{day.description&&<p>{day.description}</p>}{day.type&&<small>Loại ngày: {day.type==='SEA_DAY'?'Ngày trên biển':day.type==='PORT_DAY'?'Ngày ghé cảng':day.type}</small>}</li>)}</ol>:<p>Chưa có thông tin ngày cho lịch trình này.</p>}</section>
      <section className={s.liveInfoPanel} aria-labelledby="live-stops-heading"><p className={s.eyebrow}>ĐIỂM DỪNG DỰ KIẾN</p><h2 id="live-stops-heading">Các lần ghé cảng</h2>{data?.stops?.issue?<ExtraIssue issue={data.stops.issue} retry={retry}/>:data?.stops?.value?.length?<ol>{data.stops.value.map(stop=><li key={stop.id}><strong>{stop.port??stop.destination??'Cảng chưa có tên'}</strong>{stop.destination&&stop.port&&<span> · {stop.destination}</span>}{stop.plannedArrival&&<p>Dự kiến đến: {when(stop.plannedArrival)} · Giờ Việt Nam</p>}{stop.plannedDeparture&&<p>Dự kiến rời: {when(stop.plannedDeparture)} · Giờ Việt Nam</p>}{stop.status&&<small>Trạng thái điểm dừng: {statusName(stop.status)}</small>}</li>)}</ol>:<p>Chưa có điểm dừng cho lịch trình này.</p>}</section></>}
    </div>
    <section className={s.liveInfoPanel} aria-labelledby="live-ship-heading"><p className={s.eyebrow}>KHÔNG GIAN TRÊN TÀU</p><h2 id="live-ship-heading">Thông tin tàu</h2>{loading?<p role="status">Đang tải thông tin tàu…</p>:error?<ExtraIssue issue={{status:0,message:error}} retry={retry}/>:data?.ship.issue?<ExtraIssue issue={data.ship.issue} retry={retry}/>:data?.ship.missing?<p>Chuyến này chưa có mã tàu để tra cứu chi tiết.</p>:data?.ship.value?<dl><div><dt>Tên tàu</dt><dd>{data.ship.value.name}</dd></div>{data.ship.value.code&&<div><dt>Mã tàu</dt><dd>{data.ship.value.code}</dd></div>}{data.ship.value.decks!==undefined&&<div><dt>Số boong</dt><dd>{data.ship.value.decks}</dd></div>}{data.ship.value.capacity!==undefined&&<div><dt>Sức chứa</dt><dd>{data.ship.value.capacity} khách</dd></div>}{data.ship.value.status&&<div><dt>Trạng thái</dt><dd>{statusName(data.ship.value.status)}</dd></div>}</dl>:<p>Chưa có chi tiết tàu.</p>}</section>
  </div>
}
