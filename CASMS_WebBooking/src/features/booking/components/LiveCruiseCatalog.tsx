import {PublicCruisePackages} from './PublicCruisePackages'
import { PublicCruiseSaleState, PublicCruiseItinerary, PublicCruiseBookingEntry } from './PublicCruiseInformation'
import { useCallback } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { catalogReturn } from '../model/live-booking-navigation'
import { bookingReadFailure } from '../model/booking-feedback'
import { ApiError } from '@/shared/api'
import { Field } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LiveCruise, LiveCruisePage } from '../api/live-cruise-contract'

import { useAdapterData } from '../model/booking-state'
import { Action, ActionLink, EmptyState, Heading } from './BookingUI'
const catalogHero = '/images/ports/ha-long-bay.webp'
import s from './Booking.module.css'

type LoadIssue = { message: string; status: number }
type LoadResult<T> = { value?: T; issue?: LoadIssue }

const cruisePortPhotos = [
  { image: '/images/ports/ha-long-bay.webp', caption: 'Ảnh cảng biển · Vịnh Hạ Long, Việt Nam', match: 'ha long' },
  { image: '/images/ports/da-nang-panorama.webp', caption: 'Ảnh cảng biển · Đà Nẵng, Việt Nam', match: 'da nang' },
  { image: '/images/ports/port-klang-cruise.webp', caption: 'Ảnh cảng biển · Port Klang, Malaysia', match: 'klang' },
  { image: '/images/ports/kobe-port.webp', caption: 'Ảnh cảng biển · Kobe, Nhật Bản', match: 'kobe' },
  { image: '/images/ports/yokohama-osanbashi.webp', caption: 'Ảnh cảng biển · Yokohama, Nhật Bản', match: 'yokohama' },
  { image: '/images/ports/singapore-marina-bay.webp', caption: 'Ảnh cảng biển · Singapore', match: 'singapore' },
  { image: '/images/ports/kyushu-nagasaki.webp', caption: 'Ảnh cảng biển · Nagasaki, Nhật Bản', match: 'nagasaki' },
  { image: '/images/ports/hong-kong-victoria.webp', caption: 'Ảnh cảng biển · Hồng Kông', match: 'hong kong' },
  { image: '/images/ports/keelung-harbour.webp', caption: 'Ảnh cảng biển · Keelung, Đài Loan', match: 'keelung' },
  { image: '/images/ports/busan-port.webp', caption: 'Ảnh cảng biển · Busan, Hàn Quốc', match: 'busan' },
]

function getCruisePhoto(cruise: LiveCruise, index: number) {
  const text = `${cruise.title} ${cruise.departurePort ?? ''} ${cruise.returnPort ?? ''}`.toLowerCase()
  const found = cruisePortPhotos.find(p => text.includes(p.match))
  if (found) return found
  return cruisePortPhotos[index % cruisePortPhotos.length]
}

function issueFor(error: unknown): LoadIssue {
  if (error instanceof ApiError) {
    if (error.status === 401) return { status:401, message:`Chưa thể truy cập thông tin chuyến khởi hành. Vui lòng liên hệ bộ phận hỗ trợ.` }
    if (error.status === 403) return { status:403, message:`Bạn chưa được phép xem thông tin này. Vui lòng liên hệ bộ phận hỗ trợ.` }
    return { status:error.status, message:bookingReadFailure(error.status) }
  }
  return { status:0, message:bookingReadFailure(0) }
}

const vietnamTime = new Intl.DateTimeFormat('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Ho_Chi_Minh' })
const when = (instant:string) => vietnamTime.format(new Date(instant))
const route = (cruise:LiveCruise) => [cruise.departurePort,cruise.returnPort].filter(Boolean).join(' → ') || 'Chưa có thông tin cảng'
const liveDetailLink = (id:string) => `/cruises/${encodeURIComponent(id)}`
function LiveError({issue,retry}:{issue:LoadIssue;retry:()=>void}) {
  return <div role="alert"><EmptyState title="Không tải được danh mục chuyến khởi hành"><p>{issue.message}</p><Action onClick={retry}>Thử lại</Action>{issue.status===401&&<ActionLink secondary to="/#project-contact">Liên hệ</ActionLink>}</EmptyState></div>
}

export function LiveCruiseSearch() {
  const [params]=useSearchParams()
  const requested=Number(params.get('page')??'1')
  const page=Number.isSafeInteger(requested)&&requested>0?requested:1
  const rawType=params.get('cruiseType')
  const cruiseType=rawType==='ONE_DAY'||rawType==='MULTI_DAYS'?rawType:undefined
  return <LiveCruiseSearchPage page={page} cruiseType={cruiseType}/>
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
    <section className={s.searchHero}>
      <div className={s.catalogHeroVisual} aria-hidden="true"><img src={catalogHero} alt="Hải trình di sản Vịnh Hạ Long, Việt Nam" width="1600" height="1000" /></div>
      <div className={s.container}>
        <div className={s.searchIntro}>
          <p className={s.eyebrow}>KHÁM PHÁ HẢI TRÌNH</p>
          <h1>Hành trình đã công bố</h1>
          <p>Khám phá các chuyến khởi hành đang mở bán và gói du thuyền được công bố.</p>
        </div>
      </div>
    </section>
    <div className={s.container}>
      <div className={s.liveModeNotice}><strong>Chuyến du lịch đã công bố</strong><span>Chọn chuyến để xem thông tin đã công bố.</span><Link to="/booking/lookup">Tra cứu đặt chỗ</Link></div>
      <div className={s.catalogWorkspace}><div className={s.searchResultsHead}><div><p className={s.eyebrow}>HÀNH TRÌNH SẮP TỚI</p><Heading level={2} title={loading?'Đang tải hành trình…':issue?'Chưa tải được danh mục':`${result?.total??0} hành trình đã công bố`} description="Xem lịch khởi hành, tuyến cảng và thông tin gói du thuyền."/></div></div>
      <div className={s.liveFilterBar}><div className={s.liveFilter}><Field htmlFor="catalog-cruise-type" label="Loại hành trình"><select value={cruiseType??''} onChange={event=>{const query=new URLSearchParams(params);query.delete('page');if(event.target.value)query.set('cruiseType',event.target.value);else query.delete('cruiseType');setParams(query,{preventScrollReset:true})}}><option value="">Tất cả</option><option value="ONE_DAY">Một ngày</option><option value="MULTI_DAYS">Nhiều ngày</option></select></Field></div><p>Sắp xếp theo ngày khởi hành sớm nhất · Giờ Việt Nam</p>{cruiseType && <Action onClick={()=>{const query=new URLSearchParams(params);query.delete('cruiseType');query.delete('page');setParams(query,{preventScrollReset:true})}}>Xóa bộ lọc</Action>}</div>
      <div className={s.searchList} aria-live="polite" aria-busy={loading}>
        {loading?<p className={s.searchMessage} role="status">Đang tải hành trình…</p>
          :issue?<LiveError issue={issue} retry={retry}/>
          :result?.items.length?result.items.map((cruise,idx)=><LiveCruiseCard key={cruise.id} cruise={cruise} index={idx} from={location.pathname+location.search}/>)
            :<EmptyState title={result?.total?'Trang này không có hành trình':'Chưa có hành trình để hiển thị'}><p>{cruiseType ? 'Chưa có chuyến phù hợp với loại hành trình đang chọn. Bạn có thể xóa bộ lọc để xem tất cả.' : 'Hiện chưa có chuyến đã công bố trong trang này. Vui lòng quay lại sau.'}</p>{page>1&&<ActionLink to={pageLink(1)}>Về trang đầu</ActionLink>}</EmptyState>}
      </div>
      {result&&result.total>0&&result.page<=result.pageCount&&<nav className={s.livePagination} aria-label="Phân trang danh mục cruise"><span>Trang {result.page} / {result.pageCount} · {result.total} hành trình</span><div>{result.page>1?<Link to={pageLink(result.page-1)}>← Trang trước</Link>:<span aria-disabled="true">← Trang trước</span>}{result.page<result.pageCount?<Link to={pageLink(result.page+1)}>Trang sau →</Link>:<span aria-disabled="true">Trang sau →</span>}</div></nav>}
      </div>
    </div>
  </div>
}

function LiveCruiseCard({cruise,from,index=0}:{cruise:LiveCruise;from:string;index?:number}) {
  const photo = getCruisePhoto(cruise, index)
  return <article className={s.searchCard+' '+s.liveCard} aria-labelledby={'cruise-'+cruise.id}><div className={s.liveImage}><img src={photo.image} alt={photo.caption} loading="lazy" width="1600" height="1000"/><span className={s.photoCaption}>{photo.caption}</span></div><div className={s.searchCardBody}><p className={s.eyebrow}>HẢI TRÌNH ĐÃ CÔNG BỐ</p><h2 id={'cruise-'+cruise.id}><Link to={liveDetailLink(cruise.id)+'?from='+encodeURIComponent(from)}>{cruise.title}</Link></h2><p className={s.searchCardMeta}>{cruise.code&&`${cruise.code} · `}{cruise.ship??'Chưa có tên tàu'}</p><p className={s.searchRoute}>{route(cruise)}</p><p className={s.searchDate}>Khởi hành: {when(cruise.departure)} · Giờ Việt Nam</p><p className={s.searchDate}>Trở về: {when(cruise.returnAt)} · Giờ Việt Nam</p></div><div className={s.searchCardPrice+' '+s.liveCardAside}><p className={s.eyebrow}>GÓI DU THUYỀN</p><p><strong>Đang mở bán</strong></p><p>Giá Gói du thuyền được hiển thị trong chi tiết khi có dữ liệu hợp lệ.</p><ActionLink to={liveDetailLink(cruise.id)+'?from='+encodeURIComponent(from)}>Xem hành trình</ActionLink></div></article>
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
  const detailPhoto = getCruisePhoto(cruise, 0)
  return <div className={s.surface+' '+s.liveSurface}><section className={s.liveDetailHero}><img src={detailPhoto.image} alt={detailPhoto.caption}/><div><p className={s.eyebrow}>HẢI TRÌNH ĐÃ CÔNG BỐ</p><h1>{cruise.title}</h1><p>{cruise.code&&`${cruise.code} · `}{cruise.ship??'Chưa có tên tàu'}</p><p>{route(cruise)}</p></div></section><div className={s.container}><div className={s.liveModeNotice}><strong>Hành trình của bạn</strong><span>Xem trạng thái mở bán hiện tại, lịch trình và gói du thuyền.</span><Link to={back}>← Về danh mục</Link></div><nav className={s.liveAnchors} aria-label="Nội dung hành trình"><a href="#cruise-facts">Thời gian & cảng</a><a href="#cruise-packages">Gói du thuyền</a><a href="#cruise-extras">Lịch trình & tàu</a></nav><div className={s.liveDetailGrid}><section id="cruise-facts" className={s.liveInfoPanel}><p className={s.eyebrow}>THỜI GIAN & CẢNG</p><h2>Thông tin hành trình</h2><dl><div><dt>Khởi hành</dt><dd>{when(cruise.departure)} · Giờ Việt Nam</dd></div><div><dt>Trở về</dt><dd>{when(cruise.returnAt)} · Giờ Việt Nam</dd></div><div><dt>Cảng đi</dt><dd>{cruise.departurePort??'Chưa có dữ liệu'}</dd></div><div><dt>Cảng về</dt><dd>{cruise.returnPort??'Chưa có dữ liệu'}</dd></div><div><dt>Tàu</dt><dd>{cruise.ship??'Chưa có dữ liệu'}</dd></div></dl><p>Loại hành trình: {cruise.type==='ONE_DAY'?'Một ngày':cruise.type==='MULTI_DAYS'?'Nhiều ngày':'Chưa có thông tin'}.</p></section><aside className={s.liveInfoPanel}><p className={s.eyebrow}>TRẠNG THÁI MỞ BÁN</p><h2>Thông tin mở bán</h2><p>Xem lịch trình và các gói du thuyền được công bố cho chuyến khởi hành.</p><PublicCruiseSaleState key={cruise.id} cruiseId={cruise.id}/><PublicCruiseBookingEntry key={"booking:"+cruise.id} cruiseId={cruise.id}/><ActionLink secondary to={back}>Xem hành trình khác</ActionLink></aside></div><PublicCruisePackages key={cruise.id} cruiseId={cruise.id}/><section id="cruise-extras" aria-label="Lịch trình và tàu"><PublicCruiseItinerary key={cruise.id} cruiseId={cruise.id}/></section></div></div>
}

