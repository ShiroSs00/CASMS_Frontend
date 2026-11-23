import { useRef, useState, type KeyboardEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import type { CapturedCruisePackageBenefit, cruisePackageApi } from '@/domain/cruise-package'
import { Badge, Button, ButtonLink, Empty, Field, Loading, Notice } from '@/shared/ui'
import { cabinTypeName } from '../model/booking-presentation'
import { cabinPhotoForType } from '../model/cruise-port-photos'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
import { useUsdReference } from './UsdReference'
import styles from './CruiseDetail.module.css'

const inclusionLabels = {
  INCLUDED: 'Đã bao gồm',
  LIMITED_INCLUDED: 'Đã bao gồm, có giới hạn',
  OPTIONAL: 'Tùy chọn, chưa bao gồm',
  NOT_INCLUDED: 'Không bao gồm',
} as const

type Catalog = Awaited<ReturnType<typeof cruisePackageApi.available>>
type CatalogOffer = Catalog['offers'][number]
export type CruisePackageRead = ReturnType<typeof useReadQuery<Catalog>>

type DisplayRate = { effectiveOn: string; vndPerUsd: number; source: string }
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount)

function amountUnits(amount: string) {
  const [whole, fraction = ''] = amount.split('.')
  return BigInt(whole + fraction.padEnd(4, '0'))
}

function OfferCard({
  offer,
  rate,
  isLowest,
  bookingUrl,
  onInspectBenefits,
}: {
  offer: CatalogOffer
  rate?: DisplayRate | null
  isLowest?: boolean
  bookingUrl?: string
  onInspectBenefits?: () => void
}) {
  const { selection } = offer
  const included = selection.benefits.filter(benefit =>
    benefit.inclusion === 'INCLUDED' || benefit.inclusion === 'LIMITED_INCLUDED',
  ).slice(0, 5)
  const cabinImage = cabinPhotoForType(selection.cabinType)
  const cabinCount = selection.physicalCabinIds.length

  return <article className={`${styles.offer} ${isLowest ? styles.offerFeatured : ''}`}>
    <div className={styles.offerMedia}>
      <img src={cabinImage} alt={cabinTypeName(selection.cabinType)} width="800" height="450" loading="lazy" />
      <div className={styles.offerMediaBadges}>
        <span className={styles.offerCabinBadge}>{cabinTypeName(selection.cabinType)}</span>
        {isLowest && <span className={styles.lowestPriceTag}>Giá tốt nhất</span>}
      </div>
    </div>
    <header className={styles.offerHeader}>
      <p className={styles.offerCategory}>
        {cabinCount > 0 ? `${cabinCount} cabin mở bán` : 'Hạng phòng tiêu chuẩn'}
      </p>
      <h4>{selection.templateName}</h4>
      {selection.templateDescription && <p className={styles.offerDesc}>{selection.templateDescription}</p>}
    </header>
    {included.length > 0 && <ul className={styles.offerPreview} aria-label="Quyền lợi bao gồm">
      {included.map(benefit => <li key={benefit.sourceBenefitId}>
        <svg className={styles.checkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
        <span>{benefit.resourceName}{benefit.inclusion === 'LIMITED_INCLUDED' && ' (có giới hạn)'}</span>
      </li>)}
    </ul>}
    <div className={styles.offerFooter}>
      <div className={styles.offerPriceGroup}>
        <span className={styles.offerPriceLabel}>Giá từ</span>
        <p className={styles.offerPrice}>
          <strong>{money(Number(selection.amount), offer.currencyCode)}</strong><span> / người</span>
        </p>
        {rate && offer.currencyCode === 'VND' && <p className={styles.timeNote}>
          Ước tính {money(Number(selection.amount) / rate.vndPerUsd, 'USD')} mỗi người
        </p>}
      </div>
      <div className={styles.offerActions}>
        {onInspectBenefits && selection.benefits.length > 0 && (
          <button type="button" className={styles.inlineLinkButton} onClick={onInspectBenefits}>
            Xem quyền lợi <span aria-hidden="true">›</span>
          </button>
        )}
        {bookingUrl && (
          <ButtonLink to={bookingUrl} size="compact" autoWidth>Đặt gói này</ButtonLink>
        )}
      </div>
    </div>
  </article>
}

export function PublicCruisePackages({
  query,
  bookingUrl,
}: {
  query: CruisePackageRead
  bookingUrl?: string
}) {
  const [showUsd, setShowUsd] = useState(false)
  const [activeCabinTab, setActiveCabinTab] = useState<string>('ALL')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const hasVnd = query.data?.offers.some(offer => offer.currencyCode === 'VND') ?? false
  const { rate, loading: rateLoading } = useUsdReference(showUsd && hasVnd)

  const groups = new Map<string, CatalogOffer[]>()
  for (const offer of query.data?.offers ?? []) {
    const cabinType = offer.selection.cabinType
    const group = groups.get(cabinType)
    if (group) group.push(offer)
    else groups.set(cabinType, [offer])
  }

  const cabinTabs = [
    { key: 'ALL', label: `Tất cả (${query.data?.offers.length ?? 0})` },
    ...[...groups.entries()].map(([type, items]) => ({
      key: type,
      label: `${cabinTypeName(type)} (${items.length})`,
    })),
  ]

  const effectiveTab = activeCabinTab !== 'ALL' && !groups.has(activeCabinTab) ? 'ALL' : activeCabinTab
  const visibleGroups = effectiveTab === 'ALL'
    ? [...groups.entries()]
    : [...groups.entries()].filter(([type]) => type === effectiveTab)

  const lowestUnits = (query.data?.offers ?? []).reduce<bigint | undefined>((min, offer) => {
    const units = amountUnits(offer.selection.amount)
    return min === undefined || units < min ? units : min
  }, undefined)

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % cabinTabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + cabinTabs.length) % cabinTabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = cabinTabs.length - 1
    else return

    event.preventDefault()
    const nextTab = cabinTabs[nextIndex]
    setActiveCabinTab(nextTab.key)
    tabRefs.current[nextIndex]?.focus()
  }

  function scrollToBenefits() {
    const target = document.getElementById('cruise-benefits')
    const heading = target?.querySelector<HTMLElement>('h2')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    heading?.focus({ preventScroll: true })
  }

  return <section id={cruiseDetailSections.packages} className={styles.section} aria-labelledby="public-packages-heading">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>LỰA CHỌN LƯU TRÚ &amp; TRẢI NGHIỆM</p>
        <h2 id="public-packages-heading" tabIndex={-1}>Hạng cabin &amp; gói du thuyền</h2>
      </div>
      {hasVnd && <div className={styles.usdToggle}>
        <Button tone="secondary" size="compact" autoWidth aria-pressed={showUsd} onClick={() => setShowUsd(value => !value)}>
          {showUsd ? 'Ẩn giá USD tham khảo' : 'Xem giá USD tham khảo'}
        </Button>
      </div>}
    </div>
    {showUsd && hasVnd && <p className={styles.timeNote} role="status">{rateLoading ? 'Đang tải tỷ giá…'
      : rate ? `Giá USD ước tính theo tỷ giá ngày ${rate.effectiveOn.split('-').reverse().join('/')}. Bạn thanh toán bằng VND.`
        : 'Chưa có tỷ giá tham khảo. Bạn vẫn có thể đặt và thanh toán bằng VND.'}</p>}

    {/* UX: Hick's Law & Carbon Tabs — filter cabin types cleanly with full keyboard support */}
    {groups.size > 1 && <div className={styles.cabinTabs} role="tablist" aria-label="Lọc theo hạng cabin">
      {cabinTabs.map((tab, index) => (
        <button
          key={tab.key}
          ref={el => { tabRefs.current[index] = el }}
          type="button"
          role="tab"
          aria-selected={effectiveTab === tab.key}
          tabIndex={effectiveTab === tab.key ? 0 : -1}
          className={`${styles.cabinTab} ${effectiveTab === tab.key ? styles.cabinTabActive : ''}`}
          onClick={() => setActiveCabinTab(tab.key)}
          onKeyDown={event => handleTabKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>}

    <div className={styles.readResult} aria-live="polite" aria-busy={query.loading}>
      {query.loading && <Loading label="Đang tải hạng cabin và gói du thuyền…" />}
      {query.error && <Notice title="Chưa tải được hạng cabin và gói du thuyền" tone="warning">
        <p>{publicContentFailure(query.error)}</p>
        <Button tone="secondary" onClick={query.retry}>Tải lại gói</Button>
      </Notice>}
      {query.data && groups.size === 0 && <Empty title="Chưa có gói để hiển thị" />}
      {visibleGroups.map(([cabinType, offers]) => <section className={styles.offerGroup} key={cabinType}>
        <div className={styles.offerGroupHead}>
          <h3>{cabinTypeName(cabinType)}</h3>
          <span>{offers.length} gói đang áp dụng</span>
        </div>
        <div className={styles.offerGrid}>{offers.map(offer => (
          <OfferCard
            key={offer.selection.offerId}
            offer={offer}
            rate={rate}
            isLowest={Boolean(query.data && query.data.offers.length > 1 && lowestUnits !== undefined && amountUnits(offer.selection.amount) === lowestUnits)}
            bookingUrl={bookingUrl}
            onInspectBenefits={scrollToBenefits}
          />
        ))}</div>
      </section>)}
    </div>
  </section>
}

function BenefitTerms({ benefit }: { benefit: CapturedCruisePackageBenefit }) {
  return <div className={styles.benefitTerms}>
    <strong>{inclusionLabels[benefit.inclusion]}</strong>
    {benefit.inclusion === 'LIMITED_INCLUDED' && <p>
      Giới hạn: {benefit.quantityLimit} {benefit.usageUnit === 'PARTICIPATION' ? 'lượt tham gia' : benefit.serviceUnitCode ?? 'đơn vị chưa xác định'}.
    </p>}
    {benefit.requiresReservation === true && <Badge label="Cần đăng ký riêng" tone="warning" />}
    {benefit.eligibility && <p>{benefit.eligibility}</p>}
    {benefit.occurrences.length > 0 && <p>Lần phục vụ: {benefit.occurrences.map(item => item.name).join(' · ')}</p>}
    {benefit.usageStartsAt && benefit.usageEndsAt && <p>
      {new Date(benefit.usageStartsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
      {' – '}{new Date(benefit.usageEndsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · Giờ Việt Nam
    </p>}
  </div>
}

function offerLabel({ selection }: CatalogOffer) {
  return `${selection.templateName} · ${selection.logicalCategory}`
}

function PackageBenefit({ terms }: { terms?: CapturedCruisePackageBenefit[] }) {
  return terms?.map(benefit => <BenefitTerms key={benefit.sourceBenefitId} benefit={benefit} />)
    ?? <span className={styles.benefitUnpublished}>Chưa công bố</span>
}

function IncludedSummaryBanner({ offers }: { offers: CatalogOffer[] }) {
  const includedSet = new Map<string, { name: string; limited: boolean }>()
  const optionalSet = new Set<string>()
  for (const { selection } of offers) {
    for (const b of selection.benefits) {
      if (b.inclusion === 'INCLUDED' || b.inclusion === 'LIMITED_INCLUDED') {
        const existing = includedSet.get(b.resourceName)
        includedSet.set(b.resourceName, {
          name: b.resourceName,
          limited: existing ? existing.limited && b.inclusion === 'LIMITED_INCLUDED' : b.inclusion === 'LIMITED_INCLUDED',
        })
      } else if (b.inclusion === 'OPTIONAL') {
        optionalSet.add(b.resourceName)
      }
    }
  }
  const includedList = [...includedSet.values()].slice(0, 6)
  const optionalList = [...optionalSet].filter(name => !includedSet.has(name)).slice(0, 6)
  if (!includedList.length && !optionalList.length) return null

  return <div className={styles.includedBanner}>
    <div className={styles.includedBannerGrid}>
      <div className={styles.includedIntro}>
        <p className={styles.sectionEyebrow}>QUYỀN LỢI TRONG GÓI</p>
        <h3>Những gì đã bao gồm trong kỳ nghỉ của bạn</h3>
        <p>Tổng hợp các dịch vụ và hoạt động công bố trong danh mục gói của chuyến khởi hành này. Kiểm tra bảng bên dưới để đối chiếu chi tiết từng gói.</p>
      </div>
      {includedList.length > 0 && <ul className={styles.includedPerks} aria-label="Dịch vụ đã bao gồm trong các gói">
        {includedList.map(item => <li key={item.name}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.5 2.5 4.5-5" />
          </svg>
          <span>{item.name}{item.limited ? ' (có giới hạn theo gói)' : ''}</span>
        </li>)}
      </ul>}
    </div>
    {optionalList.length > 0 && <div className={styles.optionalStrip}>
      <strong>Tùy chọn nâng cấp thêm:</strong>
      <span>{optionalList.join(' · ')}</span>
    </div>}
  </div>
}

function BenefitComparison({ offers }: { offers: CatalogOffer[] }) {
  const [leftId, setLeftId] = useState<string>()
  const [rightId, setRightId] = useState<string>()
  const left = offers.find(offer => offer.selection.offerId === leftId) ?? offers[0]
  const otherOffers = offers.filter(offer => offer !== left)
  const right = otherOffers.find(offer => offer.selection.offerId === rightId) ?? otherOffers[0]
  const selected = right ? [left, right] : [left]
  const rows = new Map<string, { name: string; terms: Map<string, CapturedCruisePackageBenefit[]> }>()
  for (const { selection } of selected) {
    for (const benefit of selection.benefits) {
      const key = benefit.serviceId ?? benefit.onboardActivityId ?? benefit.shoreExcursionId ?? benefit.sourceBenefitId
      const row = rows.get(key) ?? { name: benefit.resourceName, terms: new Map<string, CapturedCruisePackageBenefit[]>() }
      const terms = row.terms.get(selection.offerId) ?? []
      terms.push(benefit)
      row.terms.set(selection.offerId, terms)
      rows.set(key, row)
    }
  }
  return <>
    <IncludedSummaryBanner offers={offers} />
    {offers.length > 2 && <div className={styles.compareFields}>
      <Field htmlFor="benefits-first" label="Gói thứ nhất">
        <select value={left.selection.offerId} onChange={event => setLeftId(event.target.value)}>
          {offers.map(offer => <option key={offer.selection.offerId} value={offer.selection.offerId}>{offerLabel(offer)}</option>)}
        </select>
      </Field>
      <Field htmlFor="benefits-second" label="Gói thứ hai">
        <select value={right.selection.offerId} onChange={event => setRightId(event.target.value)}>
          {otherOffers.map(offer => <option key={offer.selection.offerId} value={offer.selection.offerId}>{offerLabel(offer)}</option>)}
        </select>
      </Field>
    </div>}
    {!rows.size ? <p>Chưa có quyền lợi được công bố cho các gói đang xem.</p> : <>
      <div className={styles.benefitTable}>
        <table>
          <caption>So sánh quyền lợi theo gói du thuyền</caption>
          <thead><tr><th scope="col">Quyền lợi</th>{selected.map(offer =>
            <th key={offer.selection.offerId} scope="col">{offerLabel(offer)}</th>,
          )}</tr></thead>
          <tbody>{[...rows].map(([id, row]) => <tr key={id}>
            <th scope="row">{row.name}</th>
            {selected.map(({ selection }) => <td key={selection.offerId}>
              <PackageBenefit terms={row.terms.get(selection.offerId)} />
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <ul role="list" className={styles.benefitGroups} aria-label="So sánh quyền lợi theo gói du thuyền">
        {[...rows].map(([id, row]) => <li key={id}>
          <h3>{row.name}</h3>
          <dl>{selected.map(offer => <div key={offer.selection.offerId}>
            <dt>{offerLabel(offer)}</dt>
            <dd><PackageBenefit terms={row.terms.get(offer.selection.offerId)} /></dd>
          </div>)}</dl>
        </li>)}
      </ul>
    </>}
  </>
}

export function IncludedBenefits({ query }: { query: CruisePackageRead }) {
  return <section id="cruise-benefits" className={styles.section} aria-labelledby="cruise-benefits-heading">
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.sectionEyebrow}>ĐỐI CHIẾU MINH BẠCH</p>
        <h2 id="cruise-benefits-heading" tabIndex={-1}>Quyền lợi theo gói du thuyền</h2>
      </div>
    </div>
    {query.loading ? <Loading label="Đang tải quyền lợi…" />
      : query.error ? <p>Xem trạng thái tải ở mục Hạng cabin &amp; gói du thuyền.</p>
      : query.data?.offers.length ? <BenefitComparison offers={query.data.offers} />
      : <p>Chưa có quyền lợi được công bố.</p>}
  </section>
}
