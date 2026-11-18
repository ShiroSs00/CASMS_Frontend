import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Field, Notice } from '@/shared/ui'
import { homeCruiseDetailPath, homeCruisePhoto, homeCruiseSearch, homeCruiseType, type HomeLiveCruise } from '../model/public-booking'
import styles from './HomeShowcase.module.css'

const heroSlides = [
  { src: '/images/ports/ha-long-bay.webp', alt: 'Những đảo đá vôi và du thuyền trên Vịnh Hạ Long', label: 'Vịnh Hạ Long, Việt Nam' },
  { src: '/images/ports/da-nang-panorama.webp', alt: 'Sông Hàn nhìn từ cầu Rồng tại Đà Nẵng lúc bình minh', label: 'Đà Nẵng, Việt Nam' },
  { src: '/images/ports/yokohama-osanbashi.webp', alt: 'Nhà ga du thuyền Ōsanbashi tại Yokohama lúc hoàng hôn', label: 'Yokohama, Nhật Bản' },
  { src: '/images/ports/singapore-marina-bay.webp', alt: 'Marina Bay Cruise Centre tại Singapore', label: 'Marina Bay, Singapore' },
  { src: '/images/ports/kobe-port.webp', alt: 'Toàn cảnh cảng Kobe tại Nhật Bản', label: 'Kobe, Nhật Bản' },
  { src: '/images/ports/kyushu-nagasaki.webp', alt: 'Cảng Nagasaki trên đảo Kyushu', label: 'Nagasaki, Nhật Bản' },
  { src: '/images/ports/keelung-harbour.webp', alt: 'Cảng Keelung và các tòa nhà ven bờ', label: 'Keelung, Đài Loan' },
]

function subscribeMotion(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function subscribeVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
const pageHidden = () => document.hidden

const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const vietnamDateOnly = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function durationLabel(cruise: HomeLiveCruise): string {
  if (cruise.type === 'ONE_DAY') return 'Trong ngày'
  const startDay = Date.parse(vietnamDateOnly.format(new Date(cruise.departure)))
  const endDay = Date.parse(vietnamDateOnly.format(new Date(cruise.returnAt)))
  const days = Number.isFinite(startDay) && Number.isFinite(endDay)
    ? Math.max(1, Math.round((endDay - startDay) / 86_400_000) + 1)
    : 1
  return days <= 1 ? 'Trong ngày' : `${days} ngày ${days - 1} đêm`
}

export function HomeHero() {
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const [loaded, setLoaded] = useState<number[]>([])
  const reduce = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true)
  const hidden = useSyncExternalStore(subscribeVisibility, pageHidden, () => false)
  const rotating = !reduce && !hidden && !focused
  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => setActive(index => loaded.includes((index + 1) % heroSlides.length) ? (index + 1) % heroSlides.length : index), 6500)
    return () => window.clearInterval(timer)
  }, [rotating, loaded])
  return <section className={styles.hero} aria-labelledby="home-title" aria-roledescription="trình chiếu" onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className={styles.heroImages} aria-hidden="true">{heroSlides.map((slide, index) => <img key={slide.src} className={`${styles.heroPhoto} ${index === active ? styles.slideActive : styles.slideHidden}`} src={slide.src} alt="" width="1600" height="1067" fetchPriority={index === 0 ? 'high' : 'low'} onLoad={() => setLoaded(items => items.includes(index) ? items : [...items, index])} />)}</div>
    <div className={styles.heroShade} />
    <div className={styles.heroInner}>
      <p className={styles.eyebrow}>OCEVIE CRUISES · HẢI TRÌNH CHÂU Á</p>
      <h1 id="home-title">Khám phá biển trời.<br /><span>Tận hưởng kỳ nghỉ.</span></h1>
      <p>Khám phá những điểm đến châu Á và chọn hành trình đang mở đặt chỗ phù hợp cho kỳ nghỉ của bạn cùng OceVie.</p>
      <div className={styles.heroActions}><a className={styles.goldButton} href="#cruise-finder">Tìm hành trình <span aria-hidden="true">↗</span></a><Link className={styles.lightLink} to="/cruises">Xem tất cả hải trình <span aria-hidden="true">→</span></Link></div>
    </div>
    <div className={styles.heroFoot}><span>DI SẢN VIỆT NAM · KỲ NGHỈ TRÊN BIỂN</span><div className={styles.slideshow}><p aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">Ảnh địa danh · {heroSlides[active].label}<span className={styles.screenReader}> · {heroSlides[active].alt}</span></p></div></div>
  </section>
}

export function HomeFinder() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const cruiseType = homeCruiseType(params.get('cruiseType'))
  const [keyword, setKeyword] = useState('')
  return <section className={styles.finder} id="cruise-finder" aria-labelledby="home-finder-title">
    <div className={styles.finderIntro}>
      <p className={styles.eyebrow}>TÌM CHUYẾN DU THUYỀN</p>
      <h2 id="home-finder-title">Tìm hải trình cho kỳ nghỉ của bạn</h2>
      <p id="home-finder-help">Nhập điểm đến, tên chuyến hoặc chọn loại hành trình để xem lịch khởi hành và phòng trống.</p>
    </div>
    <form onSubmit={event => { event.preventDefault(); navigate(homeCruiseSearch(cruiseType, keyword)) }}>
      <div className={styles.finderFields}>
        <div className={styles.finderField}>
          <Field htmlFor="home-cruise-keyword" label="Điểm đến hoặc tên tour">
            <input id="home-cruise-keyword" type="search" placeholder="Ví dụ: Hạ Long, Đà Nẵng…" value={keyword} onChange={event => setKeyword(event.target.value)} />
          </Field>
        </div>
        <div className={styles.finderField}>
          <Field htmlFor="home-cruise-type" label="Loại hành trình">
            <select id="home-cruise-type" name="cruiseType" value={cruiseType} aria-describedby="home-finder-help" onChange={event => { const query = new URLSearchParams(params); if (event.target.value) query.set('cruiseType', event.target.value); else query.delete('cruiseType'); setParams(query, { replace: true, preventScrollReset: true }) }}>
              <option value="">Tất cả hành trình</option>
              <option value="ONE_DAY">Trong ngày</option>
              <option value="MULTI_DAYS">Nhiều ngày</option>
            </select>
          </Field>
        </div>
      </div>
      <Button type="submit">Tìm chuyến <span aria-hidden="true">→</span></Button>
    </form>
  </section>
}

export function LiveCruisesShowcase({
  cruises,
  loading,
  error,
  onRetry,
}: {
  cruises: HomeLiveCruise[]
  loading: boolean
  error: string
  onRetry: () => void
}) {
  const baseId = useId()
  const [activeTab, setActiveTab] = useState('ALL')

  const topPorts = useMemo(
    () => [...new Set(cruises.map(c => c.departurePort).filter((p): p is string => Boolean(p)))].slice(0, 3),
    [cruises],
  )

  const tabs = useMemo(() => [
    { key: 'ALL', label: 'Tất cả chuyến' },
    { key: 'ONE_DAY', label: 'Trong ngày' },
    { key: 'MULTI_DAYS', label: 'Nhiều ngày' },
    ...topPorts.map(port => ({ key: `PORT:${port}`, label: `Từ ${port}` })),
  ], [topPorts])

  const validTabKey = tabs.some(tab => tab.key === activeTab) ? activeTab : 'ALL'

  const filtered = useMemo(() => {
    if (validTabKey === 'ONE_DAY') return cruises.filter(c => c.type === 'ONE_DAY')
    if (validTabKey === 'MULTI_DAYS') return cruises.filter(c => c.type === 'MULTI_DAYS')
    if (validTabKey.startsWith('PORT:')) {
      const port = validTabKey.slice(5)
      return cruises.filter(c => c.departurePort === port)
    }
    return cruises
  }, [cruises, validTabKey])

  const displayList = filtered.slice(0, 8)

  return <section className={styles.liveSection} aria-labelledby="holiday-title">
    <div className={styles.showcaseHead}>
      <div className={styles.showcaseTitleWrap}>
        <p className={styles.eyebrow}>HẢI TRÌNH ĐANG MỞ ĐẶT CHỖ</p>
        <h2 id="holiday-title">Các tour du thuyền hiện có</h2>
      </div>
      <Link className={styles.sectionLink} to="/cruises">Xem tất cả hành trình →</Link>
    </div>

    <div className={styles.filterTabs} role="tablist" aria-label="Lọc nhanh các tour đang mở bán">
      {tabs.map(tab => (
        <button
          key={tab.key}
          id={`${baseId}-tab-${tab.key}`}
          type="button"
          role="tab"
          aria-selected={validTabKey === tab.key}
          className={styles.filterTab}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>

    {loading ? (
      <div className={styles.tourGrid} aria-busy="true" aria-label="Đang tải các tour hiện có">
        {[0, 1, 2, 3].map(idx => (
          <div key={idx} className={styles.skeletonCard} aria-hidden="true">
            <div className={styles.skeletonPhoto} />
            <div className={styles.skeletonLines}>
              <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
              <div className={styles.skeletonLine} />
              <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
            </div>
          </div>
        ))}
      </div>
    ) : error ? (
      <Notice title="Chưa tải được danh sách tour hiện có" tone="warning">
        <p>{error}</p>
        <Button tone="secondary" size="compact" autoWidth onClick={onRetry}>Thử lại</Button>
      </Notice>
    ) : displayList.length > 0 ? (
      <div className={styles.tourGrid}>
        {displayList.map((cruise, index) => {
          const photo = homeCruisePhoto(cruise, index)
          const detailPath = homeCruiseDetailPath(cruise.id)
          const routeLabel = cruise.departurePort && cruise.returnPort && cruise.departurePort !== cruise.returnPort
            ? `${cruise.departurePort} → ${cruise.returnPort}`
            : cruise.departurePort
              ? `Khởi hành từ ${cruise.departurePort}`
              : 'Hải trình đang cập nhật cảng'
          return (
            <article key={cruise.id} className={styles.tourCard}>
              <Link to={detailPath} className={styles.tourPhoto} aria-label={`Xem chi tiết ${cruise.title}`}>
                <img src={photo.image} alt={photo.caption} width="1600" height="1000" loading="lazy" />
                <span className={styles.tourPill}>{durationLabel(cruise)}</span>
              </Link>
              <div className={styles.tourBody}>
                <div className={styles.tourMetaTop}>
                  <span>{cruise.type === 'ONE_DAY' ? 'Trong ngày' : 'Hành trình nhiều ngày'}</span>
                  {cruise.code && <span className={styles.tourCode}>{cruise.code}</span>}
                </div>
                <h3 className={styles.tourTitle}>
                  <Link to={detailPath}>{cruise.title}</Link>
                </h3>
                <span className={styles.tourShip}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3 17l2 3h14l2-3M5 17V9l7-4 7 4v8M12 5v12" />
                  </svg>
                  {cruise.ship ?? 'Du thuyền OceVie'}
                </span>
                <p className={styles.tourRoute}>{routeLabel}</p>
              </div>
              <div className={styles.tourFooter}>
                <div className={styles.tourDate}>
                  <span>Khởi hành</span>
                  <strong>{vietnamTime.format(new Date(cruise.departure))}</strong>
                </div>
                <Link to={detailPath} className={styles.tourCta}>Xem lịch &amp; đặt vé →</Link>
              </div>
            </article>
          )
        })}
      </div>
    ) : cruises.length > 0 ? (
      <div className={styles.emptyTours}>
        <div className={styles.emptyToursCopy}>
          <strong>Chưa có tour phù hợp trong mục này</strong>
          <p>Bạn có thể chuyển sang tất cả chuyến hoặc xem toàn bộ lịch khởi hành.</p>
        </div>
        <Button type="button" tone="secondary" size="compact" autoWidth onClick={() => setActiveTab('ALL')}>Xem tất cả chuyến</Button>
      </div>
    ) : (
      <div className={styles.emptyTours}>
        <div className={styles.emptyToursCopy}>
          <strong>Hiện chưa có hành trình mới mở đặt chỗ</strong>
          <p>Khám phá trước các điểm đến nổi bật bên dưới hoặc quay lại sau để xem lịch mở bán mới.</p>
        </div>
        <Link className={styles.sectionLink} to="/destinations">Khám phá điểm đến →</Link>
      </div>
    )}
  </section>
}

export function HomeShipInvitation({ cruises = [] }: { cruises?: HomeLiveCruise[] }) {
  const activeShips = useMemo(() => {
    const map = new Map<string, { shipName: string; departurePort?: string; count: number; cruise: HomeLiveCruise }>()
    for (const cruise of cruises) {
      if (!cruise.ship) continue
      const existing = map.get(cruise.ship)
      if (existing) existing.count += 1
      else map.set(cruise.ship, { shipName: cruise.ship, departurePort: cruise.departurePort, count: 1, cruise })
    }
    return [...map.values()].slice(0, 4)
  }, [cruises])

  if (activeShips.length > 0) {
    return (
      <section className={styles.fleetBand} aria-labelledby="home-ship-title">
        <div className={styles.fleetHead}>
          <div>
            <p className={styles.eyebrow}>ĐỘI TÀU ĐANG KHAI THÁC</p>
            <h2 id="home-ship-title">Những con tàu dẫn đầu hải trình.</h2>
            <p>Khám phá không gian du thuyền đang mở bán, chọn tàu yêu thích và xem toàn bộ lịch khởi hành tương ứng.</p>
          </div>
          <Link className={styles.goldButton} to="/ships">Tìm hiểu đội tàu <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.fleetGrid}>
          {activeShips.map((entry, index) => {
            const photo = homeCruisePhoto(entry.cruise, index)
            return (
              <Link
                key={entry.shipName}
                to={`/cruises?q=${encodeURIComponent(entry.shipName)}`}
                className={styles.fleetPoster}
              >
                <img src={photo.image} alt={`${entry.shipName} · ${photo.caption}`} width="1200" height="1600" loading="lazy" />
                <div className={styles.fleetScrim}>
                  <h3>{entry.shipName}</h3>
                  <span>
                    {entry.departurePort ? `${entry.departurePort} · ` : ''}
                    {entry.count} lịch khởi hành
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    )
  }

  return <section className={styles.ship} aria-labelledby="home-ship-title">
    <div className={styles.shipPhoto}><img src="/images/ports/singapore-marina-bay.webp" alt="Tàu cập Marina Bay Cruise Centre tại Singapore; ảnh địa danh" width="1600" height="1000" loading="lazy" /><span>Marina Bay, Singapore · Ảnh cảm hứng</span></div>
    <div className={styles.shipCopy}><p className={styles.eyebrow}>OCEVIE · TÀU &amp; KHÔNG GIAN</p><h2 id="home-ship-title">Một góc nhìn mới,<br />từ phía biển.</h2><p>Con tàu là một phần của hành trình. Tìm hiểu thông tin tàu, lịch trình và lựa chọn phòng theo từng chuyến trước khi quyết định.</p><Link className={styles.goldButton} to="/ships">Khám phá tàu &amp; không gian <span aria-hidden="true">↗</span></Link></div>
  </section>
}

export function HomeBookingAccess() {
  return <section className={styles.booking} id="journey" aria-labelledby="home-lookup-title">
    <div><p className={styles.eyebrow}>ĐÃ CÓ MÃ ĐẶT CHỖ?</p><h2 id="home-lookup-title">Sẵn sàng cho ngày ra khơi.</h2><p>Tra cứu bằng mã đặt chỗ cùng email hoặc số điện thoại của người đại diện. Xem lại thông tin hành khách, phòng và hướng dẫn hợp đồng.</p><Link className={styles.navyButton} to="/booking/lookup">Tra cứu đặt chỗ <span aria-hidden="true">→</span></Link></div>
    <ol>{[['Thông tin hành khách', 'Kiểm tra danh sách và thông tin đã gửi.'], ['Phòng & gói đã chọn', 'Xem các lựa chọn đã ghi nhận trong hồ sơ.'], ['Hướng dẫn hợp đồng', 'Xem hướng dẫn hợp đồng trong hồ sơ đặt chỗ.']].map(([title, description], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
  </section>
}
