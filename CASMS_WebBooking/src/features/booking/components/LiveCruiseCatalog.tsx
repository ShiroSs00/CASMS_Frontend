import { CruiseDepartureExperience, UnavailableCruise } from './CruiseDepartureExperience'
import { PublicContact } from '@/shared/ui/PublicContact'
import { useCallback, useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { catalogReturn, cruiseDetailPath, cruiseDetailSections } from '../model/live-booking-navigation'
import { bookingReadFailure } from '../model/booking-feedback'
import { ApiError } from '@/shared/api'
import { ButtonLink, Loading, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LiveCruise, LiveCruisePage } from '../api/live-cruise-contract'
import type { decodePublicItinerary } from '../api/public-sale-contract'
import { useAdapterData } from '../model/booking-state'
import { Action, ActionLink, EmptyState } from './BookingUI'
import { primaryPhotoForCruise } from '../model/cruise-port-photos'
import s from './Booking.module.css'
import detailStyles from './CruiseDetail.module.css'
import c from './LiveCruiseCatalog.module.css'

const catalogHero = '/images/ports/ha-long-bay.webp'

type LoadIssue = { message: string; status: number }
type LoadResult<T> = { value?: T; issue?: LoadIssue }
type SortOrder = 'soonest' | 'latest' | 'title' | 'duration'
type PublicItineraryData = ReturnType<typeof decodePublicItinerary>

function getCruisePhoto(cruise: LiveCruise, index: number) {
  return primaryPhotoForCruise(cruise, index)
}

function issueFor(error: unknown): LoadIssue {
  if (error instanceof ApiError) {
    if (error.status === 401) return { status: 401, message: 'Chưa thể truy cập thông tin chuyến khởi hành. Vui lòng liên hệ bộ phận hỗ trợ.' }
    if (error.status === 403) return { status: 403, message: 'Bạn chưa được phép xem thông tin này. Vui lòng liên hệ bộ phận hỗ trợ.' }
    return { status: error.status, message: bookingReadFailure(error.status) }
  }
  return { status: 0, message: bookingReadFailure(0) }
}

const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const vietnamMonthFormatter = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const vietnamDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

const when = (instant: string) => vietnamTime.format(new Date(instant))
const departureMonthKey = (instant: string) => vietnamMonthFormatter.format(new Date(instant))
const formatMonthLabel = (ym: string) => {
  const [year, month] = ym.split('-')
  return `Tháng ${month}/${year}`
}

function durationCalendarDays(cruise: LiveCruise): number {
  if (cruise.type === 'ONE_DAY') return 1
  const startDay = Date.parse(vietnamDateFormatter.format(new Date(cruise.departure)))
  const endDay = Date.parse(vietnamDateFormatter.format(new Date(cruise.returnAt)))
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return 1
  return Math.max(1, Math.round((endDay - startDay) / 86_400_000) + 1)
}

function durationLabel(cruise: LiveCruise): string {
  const days = durationCalendarDays(cruise)
  if (days <= 1 || cruise.type === 'ONE_DAY') return 'Trong ngày'
  return `${days} ngày ${days - 1} đêm`
}

const route = (cruise: LiveCruise) => {
  if (cruise.departurePort && cruise.returnPort && cruise.departurePort === cruise.returnPort) {
    return `${cruise.departurePort} (Khứ hồi)`
  }
  return [cruise.departurePort, cruise.returnPort].filter(Boolean).join(' → ') || 'Chưa có thông tin cảng'
}

function LiveError({ issue, retry }: { issue: LoadIssue; retry: () => void }) {
  return (
    <div role="alert">
      <EmptyState title="Không tải được danh mục hải trình">
        <p>{issue.message}</p>
        <Action onClick={retry}>Thử lại</Action>
        {issue.status === 401 && <PublicContact id="catalog-error-contact" />}
      </EmptyState>
    </div>
  )
}

export function LiveCruiseSearch() {
  const [params] = useSearchParams()
  const requested = Number(params.get('page') ?? '1')
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1
  const rawType = params.get('cruiseType')
  const cruiseType = rawType === 'ONE_DAY' || rawType === 'MULTI_DAYS' ? rawType : undefined
  return <LiveCruiseSearchPage page={page} cruiseType={cruiseType} />
}

function LiveCruiseSearchPage({ page, cruiseType }: { page: number; cruiseType?: 'ONE_DAY' | 'MULTI_DAYS' }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const formId = useId()

  const keywordParam = params.get('q') ?? ''
  const monthParam = params.get('month') ?? ''
  const portParam = params.get('port') ?? ''
  const shipParam = params.get('ship') ?? ''
  const rawSort = params.get('sort')
  const sortOrder: SortOrder = rawSort === 'latest' || rawSort === 'title' || rawSort === 'duration' ? rawSort : 'soonest'

  const [draftKeyword, setDraftKeyword] = useState(keywordParam)

  function updateQuery(patch: Record<string, string | undefined>, resetPage = true) {
    const query = new URLSearchParams(params)
    if (resetPage) query.delete('page')
    for (const [k, v] of Object.entries(patch)) {
      if (v && v.trim()) query.set(k, v.trim())
      else query.delete(k)
    }
    setParams(query, { preventScrollReset: true })
  }

  function clearFilters() {
    setDraftKeyword('')
    setParams(new URLSearchParams(), { preventScrollReset: true })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    updateQuery({ q: draftKeyword })
  }

  const pageLink = (next: number) => {
    const query = new URLSearchParams(params)
    query.set('page', String(next))
    return '/cruises?' + query
  }

  const load = useCallback(async (signal: AbortSignal): Promise<LoadResult<LiveCruisePage>> => {
    try {
      return { value: await liveCruiseCatalogApi.list(page, signal, cruiseType) }
    } catch (error) {
      return { issue: issueFor(error) }
    }
  }, [page, cruiseType])

  const { data, loading, error, retry } = useAdapterData(load)
  const result = data?.value
  const issue = data?.issue ?? (error ? { status: 0, message: error } : undefined)

  const loadedItems = useMemo(() => result?.items ?? [], [result?.items])

  const availablePorts = useMemo(
    () => [...new Set(loadedItems.map(item => item.departurePort).filter((p): p is string => Boolean(p)))].sort((a, b) => a.localeCompare(b, 'vi')),
    [loadedItems],
  )
  const availableShips = useMemo(
    () => [...new Set(loadedItems.map(item => item.ship).filter((ship): ship is string => Boolean(ship)))].sort((a, b) => a.localeCompare(b, 'vi')),
    [loadedItems],
  )
  const availableMonths = useMemo(
    () => [...new Set(loadedItems.map(item => departureMonthKey(item.departure)))].sort(),
    [loadedItems],
  )

  const visibleItems = useMemo(() => {
    const q = keywordParam.trim().toLowerCase()
    const filtered = loadedItems.filter(item => {
      if (q) {
        const haystack = [item.title, item.code, item.departurePort, item.returnPort, item.ship].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (monthParam && departureMonthKey(item.departure) !== monthParam) return false
      if (portParam && item.departurePort !== portParam) return false
      if (shipParam && item.ship !== shipParam) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'latest') return Date.parse(b.departure) - Date.parse(a.departure)
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'vi')
      if (sortOrder === 'duration') return durationCalendarDays(a) - durationCalendarDays(b)
      return Date.parse(a.departure) - Date.parse(b.departure)
    })
  }, [loadedItems, keywordParam, monthParam, portParam, shipParam, sortOrder])

  const hasAnyFilter = Boolean(cruiseType || keywordParam || monthParam || portParam || shipParam)

  const resultsTitle = loading
    ? 'Đang tìm hải trình phù hợp…'
    : issue
      ? 'Chưa tải được danh mục'
      : hasAnyFilter && loadedItems.length > visibleItems.length
        ? `${visibleItems.length} / ${result?.total ?? visibleItems.length} hải trình phù hợp`
        : `${result?.total ?? visibleItems.length} hải trình đang mở đặt chỗ`

  return (
    <div className={`${s.surface} ${s.liveSurface} ${c.page}`}>
      <section className={c.hero}>
        <div className={c.heroVisual} aria-hidden="true">
          <img src={catalogHero} alt="Hải trình di sản Vịnh Hạ Long, Việt Nam" width="1600" height="1000" />
        </div>
        <div className={c.container}>
          <div className={c.heroCopy}>
            <h1>Chọn hải trình của bạn</h1>
            <p>Khám phá tuyến cảng, lịch khởi hành đang mở bán và chọn gói du thuyền phù hợp.</p>
          </div>
        </div>
      </section>

      <div className={c.container}>
        <div className={c.searchBarWrap}>
          <form className={c.searchBar} role="search" aria-label="Tìm nhanh hải trình" onSubmit={submitSearch}>
            <div className={c.searchSegment}>
              <label htmlFor={`${formId}-q`}>Tên tour hoặc điểm đến</label>
              <input
                id={`${formId}-q`}
                type="search"
                placeholder="Tìm tên chuyến, mã tour hoặc cảng…"
                value={draftKeyword}
                onChange={event => {
                  const val = event.target.value
                  setDraftKeyword(val)
                  if (!val) updateQuery({ q: '' })
                }}
              />
            </div>

            <div className={c.searchSegment}>
              <label htmlFor={`${formId}-month`}>Tháng khởi hành</label>
              <select
                id={`${formId}-month`}
                value={monthParam}
                onChange={event => updateQuery({ month: event.target.value })}
              >
                <option value="">Tất cả các tháng</option>
                {availableMonths.map(ym => (
                  <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
                ))}
              </select>
            </div>

            <div className={c.searchSegment}>
              <label htmlFor={`${formId}-port`}>Cảng khởi hành</label>
              <select
                id={`${formId}-port`}
                value={portParam}
                onChange={event => updateQuery({ port: event.target.value })}
              >
                <option value="">Tất cả cảng đi</option>
                {availablePorts.map(port => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
            </div>

            <div className={c.searchSubmitCell}>
              <button type="submit" className={c.searchSubmitBtn}>Tìm hải trình</button>
            </div>
          </form>
        </div>

        <div className={c.workspace}>
          <aside className={c.sidebar} aria-label="Bộ lọc hải trình">
            <div className={c.filterPanel}>
              <div className={c.filterHead}>
                <h2>Bộ lọc</h2>
                {hasAnyFilter && (
                  <button type="button" className={c.resetLink} onClick={clearFilters}>Đặt lại</button>
                )}
              </div>

              <div className={c.filterGroup}>
                <p className={c.filterGroupTitle}>Thời lượng &amp; loại chuyến</p>
                <div className={c.filterChoices} role="group" aria-label="Loại hành trình">
                  {([
                    ['', 'Tất cả hải trình'],
                    ['ONE_DAY', 'Chuyến trong ngày'],
                    ['MULTI_DAYS', 'Chuyến nhiều ngày'],
                  ] as const).map(([value, label]) => {
                    const selected = (cruiseType ?? '') === value
                    return (
                      <button
                        key={value || 'ALL'}
                        type="button"
                        className={c.choiceBtn}
                        aria-pressed={selected}
                        onClick={() => updateQuery({ cruiseType: value || undefined })}
                      >
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {availablePorts.length > 0 && (
                <div className={c.filterGroup}>
                  <p className={c.filterGroupTitle}>Cảng khởi hành</p>
                  <div className={c.filterChoices} role="group" aria-label="Lọc theo cảng khởi hành">
                    <button
                      type="button"
                      className={c.choiceBtn}
                      aria-pressed={!portParam}
                      onClick={() => updateQuery({ port: undefined })}
                    >
                      <span>Mọi cảng đi</span>
                    </button>
                    {availablePorts.map(port => (
                      <button
                        key={port}
                        type="button"
                        className={c.choiceBtn}
                        aria-pressed={portParam === port}
                        onClick={() => updateQuery({ port: portParam === port ? undefined : port })}
                      >
                        <span>{port}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableShips.length > 0 && (
                <div className={c.filterGroup}>
                  <p className={c.filterGroupTitle}>Du thuyền</p>
                  <div className={c.filterChoices} role="group" aria-label="Lọc theo du thuyền">
                    <button
                      type="button"
                      className={c.choiceBtn}
                      aria-pressed={!shipParam}
                      onClick={() => updateQuery({ ship: undefined })}
                    >
                      <span>Mọi tàu</span>
                    </button>
                    {availableShips.map(ship => (
                      <button
                        key={ship}
                        type="button"
                        className={c.choiceBtn}
                        aria-pressed={shipParam === ship}
                        onClick={() => updateQuery({ ship: shipParam === ship ? undefined : ship })}
                      >
                        <span>{ship}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={c.lookupBox}>
              <strong>Đã có mã đặt chỗ?</strong>
              <p>Mở lại lịch trình, xem trạng thái hợp đồng và tiến độ thanh toán của bạn.</p>
              <Link className={c.lookupLink} to="/booking/lookup">Tra cứu đặt chỗ →</Link>
            </div>
          </aside>

          <main className={c.resultsCol}>
            <div className={c.resultsTop}>
              <div className={c.resultsHeadingGroup}>
                <h2>{resultsTitle}</h2>
                <p className={c.resultsSubnote}>Hiển thị giờ khởi hành theo giờ Việt Nam (UTC+7).</p>
              </div>
              <div className={c.sortControl}>
                <label htmlFor={`${formId}-sort`}>Sắp xếp</label>
                <select
                  id={`${formId}-sort`}
                  value={sortOrder}
                  onChange={event => updateQuery({ sort: event.target.value === 'soonest' ? undefined : event.target.value }, false)}
                >
                  <option value="soonest">Khởi hành sớm nhất</option>
                  <option value="latest">Khởi hành muộn nhất</option>
                  <option value="duration">Số ngày tăng dần</option>
                  <option value="title">Tên hành trình (A–Z)</option>
                </select>
              </div>
            </div>

            {hasAnyFilter && (
              <div className={c.activeChips} aria-label="Bộ lọc đang bật">
                {keywordParam && (
                  <button type="button" className={c.chip} onClick={() => { setDraftKeyword(''); updateQuery({ q: undefined }) }}>
                    Từ khóa: {keywordParam} ×
                  </button>
                )}
                {cruiseType && (
                  <button type="button" className={c.chip} onClick={() => updateQuery({ cruiseType: undefined })}>
                    {cruiseType === 'ONE_DAY' ? 'Chuyến trong ngày' : 'Chuyến nhiều ngày'} ×
                  </button>
                )}
                {monthParam && (
                  <button type="button" className={c.chip} onClick={() => updateQuery({ month: undefined })}>
                    {formatMonthLabel(monthParam)} ×
                  </button>
                )}
                {portParam && (
                  <button type="button" className={c.chip} onClick={() => updateQuery({ port: undefined })}>
                    Cảng đi: {portParam} ×
                  </button>
                )}
                {shipParam && (
                  <button type="button" className={c.chip} onClick={() => updateQuery({ ship: undefined })}>
                    Tàu: {shipParam} ×
                  </button>
                )}
              </div>
            )}

            <div className={c.cardList} aria-live="polite" aria-busy={loading}>
              {loading ? (
                <>
                  {[0, 1, 2].map(item => (
                    <div key={item} className={c.skeletonCard} aria-hidden="true">
                      <div className={c.skeletonMedia} />
                      <div className={c.skeletonBody}>
                        <div className={`${c.skeletonLine} ${c.skeletonLineShort}`} />
                        <div className={`${c.skeletonLine} ${c.skeletonLineWide}`} />
                        <div className={c.skeletonLine} />
                        <div className={c.skeletonLine} />
                      </div>
                    </div>
                  ))}
                </>
              ) : issue ? (
                <LiveError issue={issue} retry={retry} />
              ) : visibleItems.length ? (
                visibleItems.map((cruise, idx) => (
                  <LiveCruiseCard key={cruise.id} cruise={cruise} index={idx} from={location.pathname + location.search} />
                ))
              ) : result?.total && result.items.length === 0 ? (
                <EmptyState title="Trang này chưa có hành trình">
                  <ActionLink to={pageLink(1)}>Về trang đầu</ActionLink>
                </EmptyState>
              ) : hasAnyFilter ? (
                <EmptyState title="Không tìm thấy hải trình khớp bộ lọc">
                  <p>Thử xóa bớt điều kiện tìm kiếm để xem toàn bộ chuyến đang mở bán.</p>
                  <Action onClick={clearFilters}>Xóa bộ lọc</Action>
                </EmptyState>
              ) : (
                <EmptyState title="Hiện chưa có lịch khởi hành mở bán">
                  <p>Bạn có thể quay lại sau để xem lịch mới hoặc liên hệ bộ phận hỗ trợ.</p>
                  <PublicContact id="catalog-empty-contact" />
                </EmptyState>
              )}
            </div>

            {result && result.total > 0 && result.page <= result.pageCount && (
              <nav className={c.pagination} aria-label="Phân trang danh mục hải trình">
                <span>Trang {result.page} / {result.pageCount} · {result.total} hành trình</span>
                <div className={c.paginationLinks}>
                  {result.page > 1 ? <Link to={pageLink(result.page - 1)}>← Trang trước</Link> : <span aria-disabled="true">← Trang trước</span>}
                  {result.page < result.pageCount ? <Link to={pageLink(result.page + 1)}>Trang sau →</Link> : <span aria-disabled="true">Trang sau →</span>}
                </div>
              </nav>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function LiveCruiseCard({ cruise, from, index = 0 }: { cruise: LiveCruise; from: string; index?: number }) {
  const photo = getCruisePhoto(cruise, index)
  const detailPath = cruiseDetailPath(cruise.id, from)
  const [stopsOpen, setStopsOpen] = useState(false)
  const [stopsData, setStopsData] = useState<PublicItineraryData | null>(null)
  const [stopsLoading, setStopsLoading] = useState(false)
  const [stopsError, setStopsError] = useState('')

  async function toggleStops() {
    if (stopsOpen) {
      setStopsOpen(false)
      return
    }
    setStopsOpen(true)
    if (stopsData || stopsLoading) return
    setStopsLoading(true)
    setStopsError('')
    try {
      setStopsData(await liveCruiseCatalogApi.publicItinerary(cruise.id))
    } catch (cause) {
      setStopsError(cause instanceof Error ? cause.message : 'Chưa tải được các chặng dừng.')
    } finally {
      setStopsLoading(false)
    }
  }

  return (
    <article className={c.card} aria-labelledby={'cruise-' + cruise.id}>
      <div className={c.cardMedia}>
        <img src={photo.image} alt={photo.caption} loading="lazy" width="1600" height="1000" />
        <span className={c.durationPill}>{durationLabel(cruise)}</span>
        <div className={c.cardMediaScrim}>
          <span className={c.mediaCaption}>{photo.caption}</span>
        </div>
      </div>

      <div className={c.cardContent}>
        <div className={c.cardHeader}>
          <div className={c.cardEyebrowRow}>
            <span className={c.shipName}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M3 17l2 3h14l2-3M5 17V9l7-4 7 4v8M12 5v12" />
              </svg>
              {cruise.ship ?? 'Du thuyền OceVie'}
            </span>
            {cruise.code && <span className={c.cruiseCode}>{cruise.code}</span>}
          </div>
          <h2 id={'cruise-' + cruise.id} className={c.cardTitle}>
            <Link to={detailPath}>{cruise.title}</Link>
          </h2>
        </div>

        <div className={c.cardFacts}>
          <p className={c.factLine}>
            <span className={c.factLabel}>Khởi hành từ:</span>
            <span className={c.routeValue}>{cruise.departurePort ?? 'Chưa xác định'}</span>
          </p>
          <p className={c.factLine}>
            <span className={c.factLabel}>Hải trình:</span>
            <span>{route(cruise)}</span>
          </p>
          <button
            type="button"
            className={c.stopsToggle}
            aria-expanded={stopsOpen}
            onClick={() => void toggleStops()}
          >
            {stopsOpen ? 'Thu gọn chặng dừng' : '+ Xem nhanh các chặng dừng'}
          </button>

          {stopsOpen && (
            <div className={c.stopsDrawer}>
              {stopsLoading && <span>Đang tải chặng dừng…</span>}
              {stopsError && <span>{stopsError}</span>}
              {stopsData && (
                <ul className={c.stopsList}>
                  {stopsData.days.map(day => {
                    const summary = day.portCalls
                      .map(call => {
                        const visits = call.destinationVisits.map(v => v.destinationName).filter(Boolean).join(', ')
                        return visits ? `${call.portName ?? 'Trên biển'} (${visits})` : call.portName ?? 'Trên biển'
                      })
                      .join(' → ')
                    return (
                      <li key={day.dayNumber}>
                        <strong>Ngày {day.dayNumber} ({day.date.split('-').reverse().join('/')}):</strong>{' '}
                        {summary || 'Hải trình trên biển'}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={c.cardFooter}>
          <div className={c.scheduleSummary}>
            <span>Khởi hành: <strong>{when(cruise.departure)}</strong></span>
            <span>Trở về: {when(cruise.returnAt)}</span>
          </div>
          <div className={c.cardActions}>
            <ButtonLink to={detailPath + '#' + cruiseDetailSections.itinerary} tone="secondary" size="compact" autoWidth>
              Xem lịch trình
            </ButtonLink>
            <ButtonLink to={detailPath} size="compact" autoWidth>
              Chọn gói &amp; đặt vé
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  )
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
    return (
      <div className={detailStyles.detail}>
        <h1>Chi tiết hành trình</h1>
        <Notice title="Chưa tải được thông tin chuyến" tone="warning">
          <p>{issue.message}</p>
          <ButtonLink to={back} tone="secondary" autoWidth>Về danh mục</ButtonLink>
        </Notice>
        <Action secondary onClick={retry}>Thử lại</Action>
      </div>
    )
  }
  if (!cruise || cruise.id !== cruiseId) return <UnavailableCruise back={back} />

  return <CruiseDepartureExperience key={cruise.id} cruise={cruise} back={back} />
}
