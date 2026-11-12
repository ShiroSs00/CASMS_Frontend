import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { cruisePackageApi } from '@/domain/cruise-package'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi } from '../api/booking-api'
import type { LiveCruise } from '../api/live-cruise-contract'
import { publicSaleLabels } from '../api/public-sale-contract'
import { cruiseDurationLabel } from '../model/cruise-duration'
import { photosForPorts } from '../model/cruise-port-photos'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import { PublicCruiseItinerary, type PublicItineraryRead } from './PublicCruiseInformation'
import { IncludedBenefits, PublicCruisePackages, type CruisePackageRead } from './PublicCruisePackages'
import styles from './CruiseDetail.module.css'

const departureTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const departureDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
})

const sections = [
  [cruiseDetailSections.facts, 'Thông tin chuyến'],
  [cruiseDetailSections.itinerary, 'Lịch trình'],
  ['cruise-ship', 'Trên tàu'],
  [cruiseDetailSections.packages, 'Hạng cabin & gói du thuyền'],
  ['cruise-benefits', 'Quyền lợi'],
  ['cruise-trust', 'Thông tin đặt chỗ'],
] as const

function journeyFacts(itinerary: PublicItineraryRead['data']) {
  const ports = itinerary?.days.flatMap(day => day.portCalls) ?? []
  const destinations = [...new Set(ports.flatMap(port =>
    port.destinationVisits.flatMap(visit => visit.destinationName ? [visit.destinationName] : []),
  ))]
  const duration = cruiseDurationLabel(itinerary)
  return { ports, destinations, duration }
}

function startingPrice(offers: NonNullable<CruisePackageRead['data']>['offers']) {
  let lowest: { amount: string; units: bigint } | undefined
  for (const { selection: { amount } } of offers) {
    const [whole, fraction = ''] = amount.split('.')
    const units = BigInt(whole + fraction.padEnd(4, '0'))
    if (!lowest || units < lowest.units) lowest = { amount, units }
  }
  return lowest?.amount.replace('.', ',')
}

function DepartureGallery({ photos }: { photos: ReturnType<typeof photosForPorts> }) {
  const [active, setActive] = useState<string>()
  const [unavailable, setUnavailable] = useState<string[]>([])
  const available = photos.filter(photo => !unavailable.includes(photo.image))
  const index = Math.max(0, available.findIndex(photo => photo.image === active))
  const current = available[index]
  if (!current) return null
  const location = current.caption.replace(/^Ảnh cảng biển · /, '')

  function changePhoto(step: number) {
    setActive(available[(index + step + available.length) % available.length].image)
  }

  return <figure className={styles.gallery}>
    <div className={styles.photo}>
      <img key={current.image} src={current.image} alt={location} width="1600" height="1000"
        onError={() => setUnavailable(previous => [...previous, current.image])} />
    </div>
    <figcaption className={styles.galleryCaption}>
      <span aria-live="polite">Ảnh minh họa · {location}</span>
      {available.length > 1 && <div className={styles.galleryControls} role="group" aria-label="Ảnh điểm đến">
        <Button tone="secondary" autoWidth aria-label="Ảnh trước" onClick={() => changePhoto(-1)}><span aria-hidden="true">‹</span></Button>
        <span aria-hidden="true">{index + 1}/{available.length}</span>
        <Button tone="secondary" autoWidth aria-label="Ảnh tiếp theo" onClick={() => changePhoto(1)}><span aria-hidden="true">›</span></Button>
      </div>}
    </figcaption>
  </figure>
}

function DepartureFacts({ cruise }: { cruise: LiveCruise }) {
  return <section id={cruiseDetailSections.facts} className={styles.facts} aria-labelledby="cruise-facts-heading">
    <h2 id="cruise-facts-heading" tabIndex={-1}>Thông tin chuyến</h2>
    <dl className={styles.factList}>
      {cruise.code && <div className={styles.factCode}><dt>Mã chuyến</dt><dd><strong>{cruise.code}</strong></dd></div>}
      <div><dt>Khởi hành</dt><dd><strong>{cruise.departurePort ?? 'Chưa có tên cảng'}</strong><time dateTime={cruise.departure}>{departureTime.format(new Date(cruise.departure))}</time></dd></div>
      <div><dt>Trở về</dt><dd><strong>{cruise.returnPort ?? 'Chưa có tên cảng'}</strong><time dateTime={cruise.returnAt}>{departureTime.format(new Date(cruise.returnAt))}</time></dd></div>
    </dl>
    <p className={styles.timeNote}>Giờ Việt Nam</p>
  </section>
}

function JourneyHighlights({ facts }: { facts: ReturnType<typeof journeyFacts> }) {
  if (!facts.duration && !facts.ports.length) return null
  return <section className={styles.highlights} aria-labelledby="cruise-highlights-heading">
    <h2 id="cruise-highlights-heading">Điểm nổi bật của hành trình</h2>
    <dl className={styles.highlightList}>
      {facts.duration && <div><dt>Thời lượng</dt><dd>{facts.duration}</dd></div>}
      {facts.ports.length > 0 && <div><dt>Lượt ghé cảng trong lịch</dt><dd>{facts.ports.length}</dd></div>}
      {facts.destinations.length > 0 && <div><dt>Điểm tham quan</dt><dd>{facts.destinations.join(' · ')}</dd></div>}
    </dl>
  </section>
}

function ShipExperience({ cruise }: { cruise: LiveCruise }) {
  return <section id="cruise-ship" className={`${styles.section} ${styles.shipExperience}`} aria-labelledby="cruise-ship-heading">
    <h2 id="cruise-ship-heading" tabIndex={-1}>Tàu của chuyến</h2>
    <div className={styles.shipDetails}>
      <p>{cruise.ship ?? 'Chưa có thông tin tàu'}</p>
      {cruise.ship && cruise.shipId && <ButtonLink to="/ships" tone="secondary" autoWidth>Khám phá đội tàu</ButtonLink>}
    </div>
  </section>
}

function TrustAssurance() {
  return <section id="cruise-trust" className={styles.section} aria-labelledby="cruise-trust-heading">
    <h2 id="cruise-trust-heading" tabIndex={-1}>Thông tin đặt chỗ</h2>
    <div className={styles.faq}>
      <details><summary>Tôi có cần tài khoản để đặt chỗ?</summary><p>Bạn có thể gửi yêu cầu đặt chỗ mà không cần đăng nhập.</p></details>
      <details><summary>Khi nào tôi biết tổng giá đặt chỗ?</summary><p>Tổng giá được xác nhận trong báo giá sau khi bạn chọn gói, cabin và phương án thanh toán.</p></details>
      <details><summary>Làm sao để xem lại thông tin đã đặt?</summary><p>Dùng mã đặt chỗ cùng email hoặc số điện thoại của người đại diện để tra cứu.</p><Link to="/booking/lookup">Tra cứu đặt chỗ</Link></details>
    </div>
  </section>
}

function BookingPrice({ price }: { price?: string }) {
  return price === undefined ? null : <p className={styles.referencePrice}>
    <span>Giá tham khảo từ</span><strong>{price} USD</strong><span> / người</span>
  </p>
}

export function UnavailableCruise({ back }: { back: string }) {
  return <div className={styles.detail}>
    <h1>Chuyến này hiện không có trong danh mục</h1>
    <ButtonLink to={back} tone="secondary" autoWidth>Về danh mục</ButtonLink>
  </div>
}

export function CruiseDepartureExperience({ cruise, back }: { cruise: LiveCruise; back: string }) {
  const { hash, key, pathname, search } = useLocation()
  const itinerary = useReadQuery('public-actual-itinerary:' + cruise.id,
    useCallback(signal => liveCruiseCatalogApi.publicItinerary(cruise.id, signal), [cruise.id]))
  const sale = useReadQuery('public-departure-sale:' + cruise.id,
    useCallback(signal => liveCruiseCatalogApi.departureSale(cruise.id, signal), [cruise.id]))
  const catalog = useReadQuery('public-cruise-packages:' + cruise.id,
    useCallback(signal => cruisePackageApi.available(cruise.id, signal), [cruise.id]))
  const display = sale.data?.display
  const booking = sale.data?.booking
  const revoked = display?.data?.publicDisplayEligible === false ||
    (itinerary.error instanceof ApiError && itinerary.error.code === 'CRUISE_NOT_OPEN_FOR_SALE')
  const bookingUrl = booking?.data?.sellable && booking.data.transactionReady
    ? '/booking/party?' + new URLSearchParams({ cruiseId: cruise.id, from: back })
    : undefined
  const bookingError = sale.error ?? booking?.error
  const displayError = display?.error
  const price = startingPrice(catalog.data?.offers ?? [])
  const facts = journeyFacts(itinerary.data)
  const photos = photosForPorts([cruise.departurePort, cruise.returnPort, ...facts.ports.map(port => port.portName)])
  const handledAnchor = useRef('')
  const content = useRef<HTMLDivElement>(null)
  const mobileBooking = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = mobileBooking.current
    const page = content.current
    if (!bar || !page) return
    const viewport = window.visualViewport
    function update() {
      if (!bar || !page) return
      const height = bar.offsetHeight
      const gap = viewport && viewport.scale === 1
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0
      page.style.setProperty('--booking-bar-height', height + 'px')
      page.style.setProperty('--booking-viewport-gap', gap + 'px')
    }
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    update()
    return () => {
      observer.disconnect()
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      page.style.removeProperty('--booking-bar-height')
      page.style.removeProperty('--booking-viewport-gap')
    }
  }, [bookingUrl, revoked])

  function revealFocusedControl({ target }: FocusEvent<HTMLDivElement>) {
    const bar = mobileBooking.current
    if (!bar?.offsetHeight || bar.contains(target)) return
    const bounds = target.getBoundingClientRect()
    const barBounds = bar.getBoundingClientRect()
    if (bounds.bottom > barBounds.top && bounds.top < barBounds.bottom) {
      target.scrollIntoView({ block: 'end', behavior: 'instant' })
    }
  }

  useEffect(() => {
    const sectionId = sections.find(([id]) => '#' + id === hash)?.[0]
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

  const sectionPath = (id: string) => pathname + search + '#' + id
  return <div className={styles.detail} ref={content} onFocusCapture={revealFocusedControl}>
    <Link to={back} className={styles.back}>← Về danh mục</Link>
    <div className={styles.hero}>
      <DepartureGallery photos={photos} />
      <div className={styles.heroCopy}>
        {(cruise.ship || facts.duration) && <p className={styles.shipName}>{[cruise.ship, facts.duration].filter(Boolean).join(' · ')}</p>}
        <h1>{cruise.title}</h1>
        <DepartureFacts cruise={cruise} />
        <div className={styles.heroActions}>
          {display?.data && <Badge
            label={publicSaleLabels[display.data.publicSaleState] ?? 'Chưa xác định trạng thái mở bán'}
            tone={display.data.publicSaleState === 'OPEN_FOR_SALE' ? 'success' : 'neutral'}
          />}
          <BookingPrice price={price} />
          <div className={styles.actions}>
            {bookingUrl && <ButtonLink to={bookingUrl} autoWidth>Chọn cabin</ButtonLink>}
            <ButtonLink to={sectionPath(cruiseDetailSections.itinerary)} tone="secondary" autoWidth>Xem lịch trình</ButtonLink>
          </div>
        </div>
      </div>
    </div>
    <JourneyHighlights facts={facts} />
    <nav className={styles.sectionNav} aria-label="Nội dung hành trình">
      {sections.map(([id, label]) => <Link key={id} to={sectionPath(id)}>{label}</Link>)}
    </nav>
    <div className={styles.detailLayout}>
      <div className={styles.detailBody}>
        <PublicCruiseItinerary query={itinerary} />
        <ShipExperience cruise={cruise} />
        <PublicCruisePackages query={catalog} />
        <IncludedBenefits query={catalog} />
        <TrustAssurance />
      </div>
      <aside className={styles.bookingSummary} aria-labelledby="booking-summary-heading">
        <h2 id="booking-summary-heading">Tóm tắt đặt chỗ</h2>
        <div className={styles.summaryFacts}>
          <time dateTime={cruise.departure}>{departureDate.format(new Date(cruise.departure))}</time>
          {cruise.ship && <p>{cruise.ship}</p>}
          {display?.data && <p>{publicSaleLabels[display.data.publicSaleState] ?? 'Chưa xác định trạng thái mở bán'}</p>}
        </div>
        <BookingPrice price={price} />
        <div className={styles.bookingEntry} aria-live="polite" aria-busy={sale.loading}>
          {sale.loading && <p>Đang kiểm tra khả năng đặt chỗ…</p>}
          {(bookingError || displayError) && <Notice title={bookingError ? 'Chưa thể kiểm tra khả năng đặt chỗ' : 'Chưa xác định trạng thái mở bán'} tone="warning">
            <p>{publicContentFailure(bookingError ?? displayError)}</p>
            <Button tone="secondary" onClick={sale.retry}>Kiểm tra lại</Button>
          </Notice>}
          {bookingUrl && <ButtonLink to={bookingUrl} fullWidth>Chọn cabin</ButtonLink>}
          {booking?.data && !bookingUrl && <p>Chưa thể đặt chỗ cho chuyến này.</p>}
        </div>
      </aside>
    </div>
    {bookingUrl && <div className={styles.mobileBooking} ref={mobileBooking}>
      {price !== undefined ? <BookingPrice price={price} /> : <p>Đang mở bán</p>}
      <ButtonLink to={bookingUrl} autoWidth>Chọn cabin</ButtonLink>
    </div>}
  </div>
}
