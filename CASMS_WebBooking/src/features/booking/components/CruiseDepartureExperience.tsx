import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { cruisePackageApi } from '@/domain/cruise-package'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, Notice } from '@/shared/ui'
import { liveCruiseCatalogApi, type PublicCruiseExperiences } from '../api/booking-api'
import type { LiveCruise } from '../api/live-cruise-contract'
import { publicSaleLabels } from '../api/public-sale-contract'
import { cruiseDurationLabel } from '../model/cruise-duration'
import { experiencePhotoFor, experiencePhotos, photosForPorts, portPhotoForName, primaryPhotoForCruise } from '../model/cruise-port-photos'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import { PublicCruiseItinerary, type PublicItineraryRead } from './PublicCruiseInformation'
import { IncludedBenefits, PublicCruisePackages, type CruisePackageRead } from './PublicCruisePackages'
import { useBookingModelRenderer } from './BookingModelIntegration'
import styles from './CruiseDetail.module.css'

const departureTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const departureDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
})

const sections = [
  [cruiseDetailSections.facts, 'Tổng quan'],
  [cruiseDetailSections.itinerary, 'Lịch trình'],
  ['cruise-services', 'Dịch vụ & hoạt động'],
  ['cruise-excursions', 'Tour tham quan bờ'],
  ['cruise-ship', 'Mô hình 3D tàu'],
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
  let lowest: { amount: string; currency: string; units: bigint } | undefined
  for (const { selection: { amount }, currencyCode } of offers) {
    const [whole, fraction = ''] = amount.split('.')
    const units = BigInt(whole + fraction.padEnd(4, '0'))
    if (!lowest || units < lowest.units) lowest = { amount, currency: currencyCode, units }
  }
  return lowest && `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: lowest.currency === 'VND' ? 0 : 2 }).format(Number(lowest.amount))} ${lowest.currency}`
}

function routeStops(cruise: LiveCruise, ports: ReturnType<typeof journeyFacts>['ports']) {
  const names = [
    cruise.departurePort,
    ...ports.map(p => p.portName),
    cruise.returnPort,
  ].filter((name): name is string => Boolean(name && name.trim()))
  const stops: string[] = []
  for (const name of names) {
    if (stops[stops.length - 1] !== name) stops.push(name)
  }
  return stops
}

function DepartureGallery({ photos }: { photos: ReturnType<typeof photosForPorts> }) {
  const [active, setActive] = useState<string>()
  const [unavailable, setUnavailable] = useState<string[]>([])
  const available = photos.filter(photo => !unavailable.includes(photo.image))
  const index = Math.max(0, available.findIndex(photo => photo.image === active))
  const current = available[index]
  if (!current) return null
  const location = current.caption.replace(/^Ảnh cảng biển · /, '')
  const secondary = available.filter(photo => photo.image !== current.image).slice(0, 4)

  function changePhoto(step: number) {
    setActive(available[(index + step + available.length) % available.length].image)
  }

  return <figure className={`${styles.gallery} ${secondary.length > 0 ? styles.galleryMosaic : ''}`}>
    <div className={styles.photo}>
      <img key={current.image} src={current.image} alt={location} width="1600" height="1000"
        onError={() => setUnavailable(previous => [...previous, current.image])} />
      <figcaption className={styles.galleryCaption}>
        <span aria-live="polite">Ảnh minh họa · {location}</span>
        {available.length > 1 && <div className={styles.galleryControls} role="group" aria-label="Ảnh điểm đến">
          <Button tone="secondary" autoWidth aria-label="Ảnh trước" onClick={() => changePhoto(-1)}><span aria-hidden="true">‹</span></Button>
          <span aria-hidden="true">{index + 1}/{available.length}</span>
          <Button tone="secondary" autoWidth aria-label="Ảnh tiếp theo" onClick={() => changePhoto(1)}><span aria-hidden="true">›</span></Button>
        </div>}
      </figcaption>
    </div>
    {secondary.length > 0 && <div className={styles.galleryThumbs} role="group" aria-label="Ảnh các cảng khác trong hành trình">
      {secondary.map(photo => {
        const thumbLocation = photo.caption.replace(/^Ảnh cảng biển · /, '')
        return <button key={photo.image} type="button" className={styles.galleryThumb}
          aria-label={`Xem ảnh ${thumbLocation}`} onClick={() => setActive(photo.image)}>
          <img src={photo.image} alt={thumbLocation} width="800" height="500" loading="lazy"
            onError={() => setUnavailable(previous => [...previous, photo.image])} />
          <span>{thumbLocation}</span>
        </button>
      })}
    </div>}
  </figure>
}

function VoyageRouteStrip({ stops }: { stops: string[] }) {
  if (stops.length < 2) return null
  return <div className={styles.routeStrip} aria-label="Tuyến cảng hành trình">
    <p className={styles.routeStripLabel}>Tuyến cảng dự kiến</p>
    <ol className={styles.routeStripList}>
      {stops.map((stop, idx) => (
        <li key={`${stop}-${idx}`} className={styles.routeStop}>
          <span className={styles.routeNode} aria-hidden="true">{idx + 1}</span>
          <span>{stop}</span>
        </li>
      ))}
    </ol>
  </div>
}

function DepartureFacts({ cruise }: { cruise: LiveCruise }) {
  return <dl className={styles.factList}>
    {cruise.code && <div className={styles.factCode}><dt>Mã chuyến</dt><dd><strong>{cruise.code}</strong></dd></div>}
    <div><dt>Khởi hành</dt><dd><strong>{cruise.departurePort ?? 'Chưa có tên cảng'}</strong><time dateTime={cruise.departure}>{departureTime.format(new Date(cruise.departure))}</time></dd></div>
    <div><dt>Trở về</dt><dd><strong>{cruise.returnPort ?? 'Chưa có tên cảng'}</strong><time dateTime={cruise.returnAt}>{departureTime.format(new Date(cruise.returnAt))}</time></dd></div>
  </dl>
}

function JourneyHighlights({ facts }: { facts: ReturnType<typeof journeyFacts> }) {
  if (!facts.duration && !facts.ports.length) return null
  return <section className={styles.highlights} aria-labelledby="cruise-highlights-heading">
    <h3 id="cruise-highlights-heading" className={styles.highlightsTitle}>Điểm nổi bật của hành trình</h3>
    <dl className={styles.highlightList}>
      {facts.duration && <div><dt>Thời lượng</dt><dd>{facts.duration}</dd></div>}
      {facts.ports.length > 0 && <div><dt>Lượt ghé cảng trong lịch</dt><dd>{facts.ports.length}</dd></div>}
      {facts.destinations.length > 0 && <div><dt>Điểm tham quan</dt><dd>{facts.destinations.join(' · ')}</dd></div>}
    </dl>
  </section>
}

function ShipExperience({ cruise, facts, offers }: {
  cruise: LiveCruise
  facts: ReturnType<typeof journeyFacts>
  offers: NonNullable<CruisePackageRead['data']>['offers']
}) {
  const renderShipModel = useBookingModelRenderer()
  const [highlightTab, setHighlightTab] = useState<'services' | 'destinations'>('services')
  const services = [...new Map(
    offers.flatMap(o => o.selection.benefits).map(b => [b.resourceName, b]),
  ).values()]
  const hasDestinations = facts.destinations.length > 0
  const hasServices = services.length > 0
  const activeTab = highlightTab === 'services' && !hasServices && hasDestinations ? 'destinations' : highlightTab

  return <section id="cruise-ship" className={`${styles.section} ${styles.shipExperience}`} aria-labelledby="cruise-ship-heading">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>TRẢI NGHIỆM TRÊN TÀU</p>
        <h2 id="cruise-ship-heading" tabIndex={-1}>Tàu của chuyến</h2>
      </div>
      {cruise.ship && cruise.shipId && <ButtonLink to="/ships" tone="secondary" size="compact" autoWidth>Khám phá đội tàu</ButtonLink>}
    </div>
    <div className={styles.shipCard}>
      <div className={styles.shipDetails}>
        <div>
          <p className={styles.shipTitle}>{cruise.ship ?? 'Chưa có thông tin tàu'}</p>
          <p className={styles.shipSubtitle}>
            {cruise.ship
              ? 'Không gian lưu trú, ẩm thực, giải trí và hồ bơi hướng biển được phân bổ đồng bộ theo chuyến khởi hành này.'
              : 'Thông tin tàu cho chuyến khởi hành này đang được cập nhật.'}
          </p>
        </div>
      </div>
      <div className={styles.shipVisualStrip} aria-label="Không gian nổi bật trên du thuyền">
        <figure className={styles.shipVisualCard}>
          <img src={experiencePhotos.dining} alt="Nhà hàng & Ẩm thực hướng biển" width="640" height="360" loading="lazy" />
          <figcaption>Nhà hàng &amp; Ẩm thực quốc tế</figcaption>
        </figure>
        <figure className={styles.shipVisualCard}>
          <img src={experiencePhotos.spaWellness} alt="Hồ bơi vô cực & Spa thư giãn" width="640" height="360" loading="lazy" />
          <figcaption>Boong hồ bơi &amp; Spa hướng biển</figcaption>
        </figure>
        <figure className={styles.shipVisualCard}>
          <img src={experiencePhotos.entertainment} alt="Sân khấu giải trí & Lounge buổi tối" width="640" height="360" loading="lazy" />
          <figcaption>Sân khấu giải trí &amp; Lounge</figcaption>
        </figure>
      </div>
      {cruise.shipId && renderShipModel && (
        <div className={styles.shipModelWrap} role="region" aria-label={`Mô hình 3D tàu ${cruise.ship ?? ''}`}>
          <div className={styles.shipModelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>KHÁM PHÁ KHÔNG GIAN 3D</p>
              <h3>Mô hình 3D tàu {cruise.ship ?? 'của chuyến'}</h3>
            </div>
            <span className={styles.timeNote}>Xoay, phóng to và chọn từng boong để xem vị trí cabin &amp; khu dịch vụ</span>
          </div>
          <div className={styles.shipModelCanvasBox}>
            {renderShipModel({ shipId: cruise.shipId, cruiseId: cruise.id })}
          </div>
        </div>
      )}
      {(hasServices || hasDestinations) && <div className={styles.shipHighlights}>
        <div className={styles.shipTabs} role="tablist" aria-label="Điểm nhấn trên tàu và điểm đến">
          {hasServices && <button type="button" role="tab" aria-selected={activeTab === 'services'}
            className={`${styles.shipTab} ${activeTab === 'services' ? styles.shipTabActive : ''}`}
            onClick={() => setHighlightTab('services')}>Dịch vụ &amp; hoạt động ({services.length})</button>}
          {hasDestinations && <button type="button" role="tab" aria-selected={activeTab === 'destinations'}
            className={`${styles.shipTab} ${activeTab === 'destinations' ? styles.shipTabActive : ''}`}
            onClick={() => setHighlightTab('destinations')}>Điểm tham quan ({facts.destinations.length})</button>}
        </div>
        {activeTab === 'services' && hasServices && <ul className={styles.shipHighlightGrid} aria-label="Dịch vụ và hoạt động theo gói">
          {services.map(item => <li key={item.sourceBenefitId} className={styles.shipHighlightCard}>
            <span className={styles.inclusionPill}>{item.inclusion === 'OPTIONAL' ? 'Tùy chọn' : item.inclusion === 'NOT_INCLUDED' ? 'Ngoài gói' : 'Trong gói'}</span>
            <strong>{item.resourceName}</strong>
            {item.eligibility && <p>{item.eligibility}</p>}
          </li>)}
        </ul>}
        {activeTab === 'destinations' && hasDestinations && <ul className={styles.shipHighlightGrid} aria-label="Điểm tham quan trong hành trình">
          {facts.destinations.map(dest => <li key={dest} className={styles.shipHighlightCard}>
            <span className={styles.inclusionPill}>Điểm dừng bờ</span>
            <strong>{dest}</strong>
          </li>)}
        </ul>}
      </div>}
    </div>
  </section>
}

function TrustAssurance() {
  return <section id="cruise-trust" className={styles.section} aria-labelledby="cruise-trust-heading">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>HỎI ĐÁP NHANH</p>
        <h2 id="cruise-trust-heading" tabIndex={-1}>Thông tin đặt chỗ</h2>
      </div>
    </div>
    <div className={styles.faq}>
      <details><summary>Tôi có cần tài khoản để đặt chỗ?</summary><p>Bạn có thể gửi yêu cầu đặt chỗ mà không cần đăng nhập.</p></details>
      <details><summary>Khi nào tôi biết tổng tiền đặt chỗ?</summary><p>Tổng tiền được xác nhận trong báo giá sau khi bạn chọn gói, cabin và phương án thanh toán.</p></details>
      <details><summary>Làm sao để xem lại thông tin đã đặt?</summary><p>Dùng mã đặt chỗ cùng email hoặc số điện thoại của người đại diện để tra cứu.</p><Link to="/booking/lookup">Tra cứu đặt chỗ</Link></details>
    </div>
  </section>
}

function BookingPrice({ price }: { price?: string }) {
  return price === undefined ? null : <p className={styles.referencePrice}>
    <span>Giá từ</span><strong>{price}</strong><span> / người</span>
  </p>
}

export function UnavailableCruise({ back }: { back: string }) {
  return <div className={styles.detail}>
    <h1>Chuyến này hiện không có trong danh mục</h1>
    <ButtonLink to={back} tone="secondary" autoWidth>Về danh mục</ButtonLink>
  </div>
}

function formatExpMoney(price: number | null, currencyCode: string) {
  if (price == null || price === 0) return 'Miễn phí / Theo gói'
  try {
    const curr = currencyCode || 'VND'
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: curr === 'VND' ? 0 : 2 }).format(price)} ${curr}`
  } catch {
    return `${price.toLocaleString('vi-VN')} ${currencyCode || 'VND'}`
  }
}

function CruiseServicesAndActivitiesSection({
  cruise,
  experiences,
  loading,
}: {
  cruise: LiveCruise
  experiences: PublicCruiseExperiences | null
  loading: boolean
}) {
  const [tab, setTab] = useState<'all' | 'services' | 'activities'>('all')
  const services = experiences?.services ?? []
  const activities = experiences?.activities ?? []
  const totalCount = services.length + activities.length
  const showServices = tab === 'all' || tab === 'services'
  const showActivities = tab === 'all' || tab === 'activities'

  return <section id="cruise-services" className={styles.section} aria-labelledby="cruise-services-heading">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>DỊCH VỤ &amp; TRẢI NGHIỆM TRÊN TÀU</p>
        <h2 id="cruise-services-heading" tabIndex={-1}>
          Dịch vụ cung cấp trên {cruise.ship ?? 'du thuyền'}
        </h2>
      </div>
      {cruise.ship && cruise.shipId && <ButtonLink to="/ships" tone="secondary" size="compact" autoWidth>Khám phá đội tàu</ButtonLink>}
    </div>

    {totalCount > 0 && (
      <div className={styles.shipTabs} role="tablist" aria-label="Lọc dịch vụ và hoạt động trên tàu">
        <button type="button" role="tab" aria-selected={tab === 'all'}
          className={`${styles.shipTab} ${tab === 'all' ? styles.shipTabActive : ''}`}
          onClick={() => setTab('all')}>Tất cả ({totalCount})</button>
        <button type="button" role="tab" aria-selected={tab === 'services'}
          className={`${styles.shipTab} ${tab === 'services' ? styles.shipTabActive : ''}`}
          onClick={() => setTab('services')}>Dịch vụ trên tàu ({services.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'activities'}
          className={`${styles.shipTab} ${tab === 'activities' ? styles.shipTabActive : ''}`}
          onClick={() => setTab('activities')}>Hoạt động giải trí ({activities.length})</button>
      </div>
    )}

    {loading && <p className={styles.timeNote}>Đang tải danh mục dịch vụ và hoạt động trên tàu…</p>}
    {!loading && totalCount === 0 && (
      <div className={styles.expEmptyBox}>
        Danh mục dịch vụ và hoạt động trên tàu cho chuyến khởi hành này đang được đội ngũ vận hành cập nhật.
      </div>
    )}

    {!loading && totalCount > 0 && (
      <ul className={styles.expGrid} aria-label="Danh sách dịch vụ và hoạt động trên tàu">
        {showServices && services.map(item => {
          const svcPhoto = experiencePhotoFor(`${item.categoryName ?? ''} ${item.serviceName}`)
          return <li key={`svc-${item.serviceId}-${item.deckNumber ?? 0}`} className={`${styles.expCard} ${styles.expExcursionCard}`}>
            <div className={styles.expExcursionPhoto}>
              <img src={svcPhoto} alt={item.serviceName} width="640" height="360" loading="lazy" />
            </div>
            <div className={styles.expExcursionBody}>
              <div className={styles.expCardTop}>
                <div className={styles.expBadges}>
                  <span className={styles.expCategoryTag}>{item.categoryName || 'Dịch vụ trên tàu'}</span>
                  {item.deckName && <span className={styles.expDeckTag}>
                    {item.deckNumber != null ? `Tầng ${item.deckNumber} · ` : ''}{item.deckName}
                  </span>}
                </div>
                <h3>{item.serviceName}</h3>
                {item.description && <p className={styles.expDesc}>{item.description}</p>}
              </div>
              <div className={styles.expCardFoot}>
                <span className={styles.expPrice}>{formatExpMoney(item.price, item.currencyCode)}</span>
                <span className={styles.timeNote}>
                  {item.canBuyPreCruise && item.canBuyOnboard ? 'Đặt trước hoặc trên tàu' : item.canBuyOnboard ? 'Phục vụ trên tàu' : 'Theo lịch chuyến'}
                </span>
              </div>
            </div>
          </li>
        })}
        {showActivities && activities.map(act => {
          const actPhoto = experiencePhotoFor(`${act.category ?? ''} ${act.activityName}`)
          return <li key={`act-${act.activityId}`} className={`${styles.expCard} ${styles.expExcursionCard}`}>
            <div className={styles.expExcursionPhoto}>
              <img src={actPhoto} alt={act.activityName} width="640" height="360" loading="lazy" />
            </div>
            <div className={styles.expExcursionBody}>
              <div className={styles.expCardTop}>
                <div className={styles.expBadges}>
                  <span className={styles.expCategoryTag}>{act.category || 'Hoạt động giải trí'}</span>
                  {(act.deckName || act.location) && <span className={styles.expDeckTag}>{act.deckName || act.location}</span>}
                </div>
                <h3>{act.activityName}</h3>
                {act.description && <p className={styles.expDesc}>{act.description}</p>}
              </div>
              <div className={styles.expCardFoot}>
                <span className={styles.expPrice}>{formatExpMoney(act.price, act.currencyCode)}</span>
                {act.startTime && <span className={styles.timeNote}>{departureTime.format(new Date(act.startTime))}</span>}
              </div>
            </div>
          </li>
        })}
      </ul>
    )}
  </section>
}

function CruiseShoreExcursionsSection({
  experiences,
  loading,
}: {
  experiences: PublicCruiseExperiences | null
  loading: boolean
}) {
  const excursions = experiences?.shoreExcursions ?? []
  return <section id="cruise-excursions" className={styles.section} aria-labelledby="cruise-excursions-heading">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>KHÁM PHÁ ĐIỂM DỪNG BỜ</p>
        <h2 id="cruise-excursions-heading" tabIndex={-1}>
          Tour tham quan bờ {excursions.length > 0 ? `(${excursions.length})` : ''}
        </h2>
      </div>
    </div>
    {loading && <p className={styles.timeNote}>Đang tải danh sách tour tham quan bờ…</p>}
    {!loading && excursions.length === 0 && (
      <div className={styles.expEmptyBox}>
        Các tour tham quan bờ (Shore Excursions) cho từng điểm dừng của hải trình này đang được cập nhật. Bạn vẫn có thể đặt chỗ du thuyền ngay hôm nay và đăng ký tour bờ sau.
      </div>
    )}
    {!loading && excursions.length > 0 && (
      <ul className={styles.expGrid} aria-label="Danh sách tour tham quan bờ">
        {excursions.map(ex => {
          const photo = portPhotoForName(ex.portName)
          return <li key={ex.excursionId} className={`${styles.expCard} ${styles.expExcursionCard}`}>
            {photo && (
              <div className={styles.expExcursionPhoto}>
                <img src={photo.image} alt={ex.portName || ex.excursionName} width="640" height="360" loading="lazy" />
              </div>
            )}
            <div className={styles.expExcursionBody}>
              <div className={styles.expBadges}>
                <span className={styles.expCategoryTag}>{ex.portName || 'Điểm dừng bờ'}</span>
                {ex.maximumCapacity != null && <span className={styles.expDeckTag}>Tối đa {ex.maximumCapacity} khách</span>}
              </div>
              <h3>{ex.excursionName}</h3>
              {ex.meetingPoint && <p className={styles.expDesc}>Điểm tập trung: {ex.meetingPoint}</p>}
              {ex.startTime && (
                <p className={styles.timeNote}>
                  {departureTime.format(new Date(ex.startTime))}
                  {ex.plannedReturnTime ? ` – ${departureTime.format(new Date(ex.plannedReturnTime))}` : ''}
                </p>
              )}
              <div className={styles.expCardFoot}>
                <span className={styles.expPrice}>{formatExpMoney(ex.price, ex.currencyCode)}</span>
                <span className={styles.timeNote}>Đăng ký theo chuyến</span>
              </div>
            </div>
          </li>
        })}
      </ul>
    )}
  </section>
}

export function CruiseDepartureExperience({ cruise, back }: { cruise: LiveCruise; back: string }) {
  const { hash, key, pathname, search } = useLocation()
  const itinerary = useReadQuery('public-actual-itinerary:' + cruise.id,
    useCallback(signal => liveCruiseCatalogApi.publicItinerary(cruise.id, signal), [cruise.id]))
  const experiences = useReadQuery('public-cruise-experiences:' + cruise.id,
    useCallback(signal => liveCruiseCatalogApi.publicExperiences(cruise.id, signal), [cruise.id]))
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
  const offers = catalog.data?.offers ?? []
  const price = startingPrice(offers)
  const facts = journeyFacts(itinerary.data)
  const photos = photosForPorts([cruise.departurePort, cruise.returnPort, ...facts.ports.map(port => port.portName)])
  const heroPhoto = photos[0] ?? primaryPhotoForCruise(cruise)
  const stops = routeStops(cruise, facts.ports)
  const [copied, setCopied] = useState(false)
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

  async function shareCruise() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  if (revoked) return <UnavailableCruise back={back} />

  const sectionPath = (id: string) => pathname + search + '#' + id
  return <div className={styles.detail} ref={content} onFocusCapture={revealFocusedControl}>
    {/* UX: Editorial Hero Banner + Floating Quick-Bar inspired by modern cruise discovery */}
    <header className={styles.heroShell}>
      <div className={styles.heroBackdrop}>
        <img src={heroPhoto.image} alt="" aria-hidden="true" width="1600" height="1000" fetchPriority="high" />
        <div className={styles.heroScrim} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroTopRow}>
            <Link to={back} className={styles.back}>← Về danh mục</Link>
            <div className={styles.heroMetaRight}>
              {display?.data && <Badge
                label={publicSaleLabels[display.data.publicSaleState] ?? 'Chưa xác định trạng thái mở bán'}
                tone={display.data.publicSaleState === 'OPEN_FOR_SALE' ? 'success' : 'neutral'}
              />}
              <button type="button" className={styles.shareButton} onClick={() => void shareCruise()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
                <span>{copied ? 'Đã sao chép' : 'Chia sẻ'}</span>
              </button>
            </div>
          </div>
          <div className={styles.heroHeadline}>
            {(cruise.ship || facts.duration || cruise.code) && (
              <p className={styles.shipName}>
                {[cruise.ship, facts.duration, cruise.code].filter(Boolean).join(' · ')}
              </p>
            )}
            <h1>{cruise.title}</h1>
            <p className={styles.heroRoute}>
              {cruise.departurePort ?? 'Chưa có tên cảng'} → {cruise.returnPort ?? 'Chưa có tên cảng'}
            </p>
          </div>
        </div>
      </div>

      {/* UX: Hick's Law — Scannable quick-summary bar with 1 dominant primary CTA */}
      <div className={styles.quickBar}>
        <div className={styles.quickBarCell}>
          <span>Khởi hành</span>
          <strong>{departureDate.format(new Date(cruise.departure))}</strong>
          <small>{cruise.departurePort ?? 'Chưa có tên cảng'}</small>
        </div>
        <div className={styles.quickBarCell}>
          <span>Trở về</span>
          <strong>{departureDate.format(new Date(cruise.returnAt))}</strong>
          <small>{cruise.returnPort ?? 'Chưa có tên cảng'}</small>
        </div>
        <div className={styles.quickBarCell}>
          <span>Tàu &amp; thời lượng</span>
          <strong>{cruise.ship ?? 'Chưa có thông tin tàu'}</strong>
          <small>{facts.duration ?? 'Giờ Việt Nam'}</small>
        </div>
        <div className={styles.quickBarAction}>
          <BookingPrice price={price} />
          <div className={styles.actions}>
            {bookingUrl && <ButtonLink to={bookingUrl} autoWidth>Bắt đầu đặt chỗ</ButtonLink>}
            <ButtonLink to={sectionPath(cruiseDetailSections.itinerary)} tone="secondary" autoWidth>Xem lịch trình</ButtonLink>
          </div>
        </div>
      </div>
    </header>

    <nav className={styles.sectionNav} aria-label="Nội dung hành trình">
      {sections.map(([id, label]) => <Link key={id} to={sectionPath(id)}>{label}</Link>)}
    </nav>

    <div className={styles.detailLayout}>
      <div className={styles.detailBody}>
        <section id={cruiseDetailSections.facts} className={`${styles.section} ${styles.facts}`} aria-labelledby="cruise-facts-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>TỔNG QUAN HẢI TRÌNH</p>
              <h2 id="cruise-facts-heading" tabIndex={-1}>Thông tin chuyến</h2>
            </div>
            <span className={styles.timeNote}>Giờ Việt Nam</span>
          </div>
          <VoyageRouteStrip stops={stops} />
          <DepartureFacts cruise={cruise} />
          <JourneyHighlights facts={facts} />
          <DepartureGallery photos={photos} />
        </section>

        <PublicCruiseItinerary query={itinerary} />
        <CruiseServicesAndActivitiesSection cruise={cruise} experiences={experiences.data} loading={experiences.loading} />
        <CruiseShoreExcursionsSection experiences={experiences.data} loading={experiences.loading} />
        <ShipExperience cruise={cruise} facts={facts} offers={offers} />
        <PublicCruisePackages query={catalog} bookingUrl={bookingUrl} />
        <IncludedBenefits query={catalog} />
        <TrustAssurance />
      </div>

      <aside className={styles.bookingSummary} aria-labelledby="booking-summary-heading">
        <div className={styles.summaryTop}>
          <p className={styles.sectionEyebrow}>TÓM TẮT ĐẶT CHỖ</p>
          <h2 id="booking-summary-heading">{cruise.title}</h2>
        </div>
        <dl className={styles.summaryFacts}>
          <div><dt>Khởi hành</dt><dd><time dateTime={cruise.departure}>{departureDate.format(new Date(cruise.departure))}</time></dd></div>
          {cruise.ship && <div><dt>Tàu</dt><dd>{cruise.ship}</dd></div>}
          {facts.duration && <div><dt>Thời lượng</dt><dd>{facts.duration}</dd></div>}
          {display?.data && <div><dt>Trạng thái</dt><dd>{publicSaleLabels[display.data.publicSaleState] ?? 'Chưa xác định trạng thái mở bán'}</dd></div>}
        </dl>
        <div className={styles.summaryPriceBox}>
          <BookingPrice price={price} />
          <p className={styles.summaryNote}>Giá tham khảo mỗi khách. Tổng tiền &amp; lịch đóng từng đợt tự động tính khi xác nhận.</p>
          <ul className={styles.summaryPerks} aria-label="Chính sách thanh toán áp dụng">
            <li>✓ Hỗ trợ đặt cọc giữ chỗ từ 30%</li>
            <li>✓ Thanh toán 1 lần, 2 đợt hoặc 3 đợt</li>
            <li>✓ Chuyển khoản nhanh qua VietQR</li>
          </ul>
        </div>
        <div className={styles.bookingEntry} aria-live="polite" aria-busy={sale.loading}>
          {sale.loading && <p>Đang kiểm tra khả năng đặt chỗ…</p>}
          {(bookingError || displayError) && <Notice title={bookingError ? 'Chưa thể kiểm tra khả năng đặt chỗ' : 'Chưa xác định trạng thái mở bán'} tone="warning">
            <p>{publicContentFailure(bookingError ?? displayError)}</p>
            <Button tone="secondary" onClick={sale.retry}>Kiểm tra lại</Button>
          </Notice>}
          {bookingUrl && <ButtonLink to={bookingUrl} fullWidth>Bắt đầu đặt chỗ</ButtonLink>}
          {booking?.data && !bookingUrl && <p>Chưa thể đặt chỗ cho chuyến này.</p>}
        </div>
      </aside>
    </div>

    {bookingUrl && <div className={styles.mobileBooking} ref={mobileBooking}>
      {price !== undefined ? <BookingPrice price={price} /> : <p>Đang mở bán</p>}
      <ButtonLink to={bookingUrl} autoWidth>Bắt đầu đặt chỗ</ButtonLink>
    </div>}
  </div>
}
