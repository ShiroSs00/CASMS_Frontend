import { CruiseDepartureExperience, UnavailableCruise } from './CruiseDepartureExperience'
import { PublicContact } from '@/shared/ui/PublicContact'
import { useCallback } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { catalogReturn, cruiseDetailPath, cruiseDetailSections } from '../model/live-booking-navigation'
import { bookingReadFailure } from '../model/booking-feedback'
import { ApiError } from '@/shared/api'
import { ButtonLink, Field, Loading, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LiveCruise, LiveCruisePage } from '../api/live-cruise-contract'

import { useAdapterData } from '../model/booking-state'
import { Action, ActionLink, EmptyState, Heading } from './BookingUI'
const catalogHero = '/images/ports/ha-long-bay.webp'
import s from './Booking.module.css'
import detailStyles from './CruiseDetail.module.css'
import { cruisePortPhotos } from '../model/cruise-port-photos'

type LoadIssue = { message: string; status: number }
type LoadResult<T> = { value?: T; issue?: LoadIssue }

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
function LiveError({issue,retry}:{issue:LoadIssue;retry:()=>void}) {
  return <div role="alert"><EmptyState title="Không tải được danh mục chuyến khởi hành"><p>{issue.message}</p><Action onClick={retry}>Thử lại</Action>{issue.status===401&&<PublicContact id="catalog-error-contact" />}</EmptyState></div>
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
  function clearFilters() {
    const query = new URLSearchParams(params)
    query.delete('cruiseType')
    query.delete('page')
    setParams(query, {preventScrollReset:true})
  }
  const pageLink=(next:number)=>{const query=new URLSearchParams(params);query.set('page',String(next));return '/cruises?'+query}
  const load=useCallback(async(signal:AbortSignal):Promise<LoadResult<LiveCruisePage>>=>{
    try { return { value:await liveCruiseCatalogApi.list(page,signal,cruiseType) } }
    catch(error) { return { issue:issueFor(error) } }
  },[page,cruiseType])
  const {data,loading,error,retry}=useAdapterData(load)
  const result=data?.value
  const issue=data?.issue??(error?{status:0,message:error}:undefined)
  return <div className={s.surface+' '+s.searchSurface+' '+s.liveSurface+' '+s.catalogRedesign}>
    <section className={s.searchHero}>
      <div className={s.catalogHeroVisual} aria-hidden="true"><img src={catalogHero} alt="Hải trình di sản Vịnh Hạ Long, Việt Nam" width="1600" height="1000" /></div>
      <div className={s.container}>
        <div className={s.searchIntro}>

          <h1>Chọn hải trình của bạn</h1>
          <p>Khám phá tuyến cảng, lịch khởi hành và gói du thuyền.</p>
        </div>
      </div>
    </section>
    <div className={s.container}>
      <div className={s.liveModeNotice}><Link to="/booking/lookup">Tra cứu đặt chỗ</Link></div>
      <div className={s.catalogWorkspace}><div className={s.searchResultsHead}><div><Heading level={2} title={loading?'Đang tải hành trình…':issue?'Chưa tải được danh mục':`${result?.total??0} hành trình đã công bố`} /></div></div>
      <div className={s.liveFilterBar}><div className={s.liveFilter}><Field htmlFor="catalog-cruise-type" label="Loại hành trình"><select value={cruiseType??''} onChange={event=>{const query=new URLSearchParams(params);query.delete('page');if(event.target.value)query.set('cruiseType',event.target.value);else query.delete('cruiseType');setParams(query,{preventScrollReset:true})}}><option value="">Tất cả</option><option value="ONE_DAY">Một ngày</option><option value="MULTI_DAYS">Nhiều ngày</option></select></Field></div><p>Sắp xếp theo ngày khởi hành sớm nhất · Giờ Việt Nam</p>{cruiseType && <Action onClick={clearFilters}>Xóa bộ lọc</Action>}</div>
      <div className={s.searchList} aria-live="polite" aria-busy={loading}>
        {loading?<p className={s.searchMessage} role="status">Đang tải hành trình…</p>
          :issue?<LiveError issue={issue} retry={retry}/>
          :result?.items.length?result.items.map((cruise,idx)=><LiveCruiseCard key={cruise.id} cruise={cruise} index={idx} from={location.pathname+location.search}/>)
             : result?.total ? <EmptyState title="Trang này không có hành trình">
              <ActionLink to={pageLink(1)}>Về trang đầu</ActionLink>
            </EmptyState> : cruiseType ? <EmptyState title="Không có hành trình phù hợp">
              <Action onClick={clearFilters}>Xem mọi loại hành trình</Action>
            </EmptyState> : <EmptyState title="Chưa có lịch khởi hành mở bán">
              <p>Bạn có thể quay lại sau để xem lịch mới.</p>
              <PublicContact id="catalog-empty-contact" />
            </EmptyState>}
      </div>
      {result&&result.total>0&&result.page<=result.pageCount&&<nav className={s.livePagination} aria-label="Phân trang danh mục cruise"><span>Trang {result.page} / {result.pageCount} · {result.total} hành trình</span><div>{result.page>1?<Link to={pageLink(result.page-1)}>← Trang trước</Link>:<span aria-disabled="true">← Trang trước</span>}{result.page<result.pageCount?<Link to={pageLink(result.page+1)}>Trang sau →</Link>:<span aria-disabled="true">Trang sau →</span>}</div></nav>}
      </div>
    </div>
  </div>
}

function LiveCruiseCard({ cruise, from, index = 0 }: { cruise: LiveCruise; from: string; index?: number }) {
  const photo = getCruisePhoto(cruise, index)
  const detailPath = cruiseDetailPath(cruise.id, from)

  return <article className={`${s.searchCard} ${s.liveCard}`} aria-labelledby={'cruise-' + cruise.id}>
    <div className={s.liveImage}>
      <img src={photo.image} alt={photo.caption} loading="lazy" width="1600" height="1000" />
      <span className={s.photoCaption}>{photo.caption}</span>
    </div>
    <div className={s.searchCardBody}>
      <h2 id={'cruise-' + cruise.id}><Link to={detailPath}>{cruise.title}</Link></h2>
      <p className={s.searchCardMeta}>{cruise.code && `${cruise.code} · `}{cruise.ship ?? 'Chưa có tên tàu'}</p>
      <p className={s.searchRoute}>{route(cruise)}</p>
      <p className={s.searchDate}>Khởi hành: {when(cruise.departure)} · Giờ Việt Nam</p>
      <p className={s.searchDate}>Trở về: {when(cruise.returnAt)} · Giờ Việt Nam</p>
    </div>
    <div className={`${s.searchCardPrice} ${s.liveCardAside}`}>
      <div className={detailStyles.actions}>
        <ButtonLink to={detailPath + '#' + cruiseDetailSections.itinerary} tone="secondary" autoWidth>Xem lịch trình</ButtonLink>
        <ButtonLink to={detailPath} autoWidth>Xem chi tiết</ButtonLink>
      </div>
    </div>
  </article>
}

export function LiveCruiseDetail() {
  const { cruiseId } = useParams()
  const [params] = useSearchParams()
  const back = catalogReturn(params.get('from'))
  const load = useCallback(async (signal: AbortSignal): Promise<LoadResult<LiveCruise | null>> => {
    try {
      return { value: cruiseId ? await liveCruiseCatalogApi.detail(cruiseId, signal) : null }
    } catch (error) {
      return { issue: issueFor(error) }
    }
  }, [cruiseId])
  const { data, loading, error, retry } = useAdapterData(load)
  const issue = data?.issue ?? (error ? { status: 0, message: error } : undefined)
  const cruise = data?.value

  if (loading) return <div className={detailStyles.detail}><Loading label="Đang tải chi tiết hành trình…" /></div>
  if (issue && issue.status !== 403 && issue.status !== 404) {
    return <div className={detailStyles.detail}>
      <h1>Chi tiết hành trình</h1>
      <Notice title="Chưa tải được thông tin chuyến" tone="warning">
        <p>{issue.message}</p>
        <ButtonLink to={back} tone="secondary" autoWidth>Về danh mục</ButtonLink>
      </Notice>
      <Action secondary onClick={retry}>Thử lại</Action>
    </div>
  }
  if (!cruise || cruise.id !== cruiseId) return <UnavailableCruise back={back} />

  return <CruiseDepartureExperience key={cruise.id} cruise={cruise} back={back} />
}
