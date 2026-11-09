import {PublicCruisePackages} from './PublicCruisePackages'
import { PublicCruiseSaleState, PublicCruiseItinerary, PublicCruiseBookingEntry } from './PublicCruiseInformation'
import { PublicContact } from '@/app/layouts/PublicContact'
import { useCallback, useEffect, useRef } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { catalogReturn, cruiseDetailPath, cruiseDetailSections } from '../model/live-booking-navigation'
import { bookingReadFailure } from '../model/booking-feedback'
import { ApiError, useReadQuery } from '@/shared/api'
import { ButtonLink, Field, Loading, Notice, Panel } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LiveCruise, LiveCruisePage } from '../api/live-cruise-contract'

import { useAdapterData } from '../model/booking-state'
import { Action, ActionLink, EmptyState, Heading } from './BookingUI'
const catalogHero = '/images/ports/ha-long-bay.webp'
import s from './Booking.module.css'
import detailStyles from './CruiseDetail.module.css'

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

function UnavailableCruise({ back }: { back: string }) {
  return <div className={detailStyles.detail}>
    <h1>Chuyến này hiện không có trong danh mục</h1>
    <ButtonLink to={back} tone="secondary" autoWidth>Về danh mục</ButtonLink>
  </div>
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

  return <CruiseDetailContent key={cruise.id} cruise={cruise} back={back} />
}

function CruiseDetailContent({ cruise, back }: { cruise: LiveCruise; back: string }) {
  const { hash, key, pathname, search } = useLocation()
  const itinerary = useReadQuery('public-actual-itinerary:' + cruise.id,
    useCallback(signal => liveCruiseCatalogApi.publicItinerary(cruise.id, signal), [cruise.id]))
  const sale = useReadQuery('public-display-state:' + cruise.id,
    useCallback(signal => liveCruiseCatalogApi.publicSaleState(cruise.id, signal), [cruise.id]))
  const revoked = sale.data?.publicDisplayEligible === false ||
    (itinerary.error instanceof ApiError && itinerary.error.code === 'CRUISE_NOT_OPEN_FOR_SALE')
  const handledAnchor = useRef('')
  const content = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sectionId = Object.values(cruiseDetailSections).find(id => '#' + id === hash)
    const navigation = key + hash
    if (!sectionId) {
      handledAnchor.current = ''
      return
    }
    if (revoked || handledAnchor.current === navigation) return
    const section = content.current?.querySelector<HTMLElement>('#' + sectionId)
    const heading = section?.querySelector('h2')
    if (!section || !heading) return

    handledAnchor.current = navigation
    const targetTop = parseFloat(getComputedStyle(section).scrollMarginTop) || 0
    const bounds = heading.getBoundingClientRect()
    if (bounds.top < targetTop || bounds.bottom > window.innerHeight || section.getBoundingClientRect().top > targetTop + 24) {
      section.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    heading.focus({ preventScroll: true })
  }, [hash, key, revoked])

  if (revoked) return <UnavailableCruise back={back} />

  const photo = getCruisePhoto(cruise, 0)
  const sectionPath = (id: string) => pathname + search + '#' + id
  return <div className={detailStyles.detail} ref={content}>
    <Link to={back} className={detailStyles.back}>Về danh mục</Link>
    <h1>{cruise.title}</h1>
    <nav className={detailStyles.sectionNav} aria-label="Nội dung hành trình">
      <Link to={sectionPath(cruiseDetailSections.facts)}>Thông tin chuyến</Link>
      <Link to={sectionPath(cruiseDetailSections.itinerary)}>Lịch trình</Link>
      <Link to={sectionPath(cruiseDetailSections.packages)}>Hạng cabin &amp; gói</Link>
    </nav>
    <div className={detailStyles.overview}>
      <figure className={detailStyles.photo}>
        <img src={photo.image} alt={photo.caption} width="1600" height="1000" />
        <figcaption>Minh họa · {photo.caption}</figcaption>
      </figure>
      <Panel className={detailStyles.overviewPanel}>
        <section id={cruiseDetailSections.facts} aria-labelledby="cruise-facts-heading" className={detailStyles.facts}>
          <h2 id="cruise-facts-heading" tabIndex={-1}>Thông tin chuyến</h2>
          <p className={detailStyles.shipName}>{cruise.ship ?? 'Chưa có tên tàu'}</p>
          <dl className={detailStyles.factList}>
            <div><dt>Khởi hành</dt><dd><strong>{cruise.departurePort ?? 'Chưa có tên cảng'}</strong><time dateTime={cruise.departure}>{when(cruise.departure)}</time></dd></div>
            <div><dt>Trở về</dt><dd><strong>{cruise.returnPort ?? 'Chưa có tên cảng'}</strong><time dateTime={cruise.returnAt}>{when(cruise.returnAt)}</time></dd></div>
          </dl>
          <p className={detailStyles.timeNote}>Giờ Việt Nam</p>
        </section>
        <div className={detailStyles.saleActions}>
          <PublicCruiseSaleState query={sale} />
          <div className={detailStyles.actions}>
            <PublicCruiseBookingEntry cruiseId={cruise.id} />
            <ButtonLink to={sectionPath(cruiseDetailSections.itinerary)} tone="secondary" autoWidth>Xem lịch trình</ButtonLink>
          </div>
        </div>
      </Panel>
    </div>
    <PublicCruiseItinerary query={itinerary} />
    <Panel title="Tàu của chuyến" className={detailStyles.shipPanel}>
      <div className={detailStyles.shipDetails}>
        <p>{cruise.ship ?? 'Chưa có thông tin tàu'}</p>
        {cruise.ship && cruise.shipId && <ButtonLink to="/ships" tone="secondary" autoWidth>Khám phá đội tàu</ButtonLink>}
      </div>
    </Panel>
    <PublicCruisePackages cruiseId={cruise.id} />
  </div>
}
