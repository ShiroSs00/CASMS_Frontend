import { useState } from 'react'
import type { useReadQuery } from '@/shared/api'
import type { CapturedCruisePackageBenefit, cruisePackageApi } from '@/domain/cruise-package'
import { Badge, Button, Empty, Field, Loading, Notice } from '@/shared/ui'
import { cabinTypeName } from '../model/booking-presentation'
import { cruiseDetailSections } from '../model/live-booking-navigation'
import { publicContentFailure } from '../model/public-content-feedback'
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

function OfferCard({ offer }: { offer: CatalogOffer }) {
  const { selection } = offer
  const included = selection.benefits.filter(benefit =>
    benefit.inclusion === 'INCLUDED' || benefit.inclusion === 'LIMITED_INCLUDED',
  ).slice(0, 3)
  return <article className={styles.offer}>
    <header>
      <p className={styles.offerCategory}>{selection.logicalCategory}</p>
      <h4>{selection.templateName}</h4>
      {selection.templateDescription && <p>{selection.templateDescription}</p>}
    </header>
    <p className={styles.offerPrice}>
      <strong>{selection.amount.replace('.', ',')} {offer.currencyCode}</strong><span> / người</span>
    </p>
    {included.length > 0 && <ul className={styles.offerPreview} aria-label="Quyền lợi bao gồm">
      {included.map(benefit => <li key={benefit.sourceBenefitId}>{benefit.resourceName}
        {benefit.inclusion === 'LIMITED_INCLUDED' && ' (có giới hạn)'}</li>)}
    </ul>}
  </article>
}

export function PublicCruisePackages({ query }: { query: CruisePackageRead }) {
  const groups = new Map<string, CatalogOffer[]>()
  for (const offer of query.data?.offers ?? []) {
    const cabinType = offer.selection.cabinType
    const group = groups.get(cabinType)
    if (group) group.push(offer)
    else groups.set(cabinType, [offer])
  }

  return <section id={cruiseDetailSections.packages} className={styles.section} aria-labelledby="public-packages-heading">
    <div className={styles.sectionHeading}><h2 id="public-packages-heading" tabIndex={-1}>Hạng cabin &amp; gói du thuyền</h2></div>
    <div className={styles.readResult} aria-live="polite" aria-busy={query.loading}>
      {query.loading && <Loading label="Đang tải hạng cabin và gói du thuyền…" />}
      {query.error && <Notice title="Chưa tải được hạng cabin và gói du thuyền" tone="warning">
        <p>{publicContentFailure(query.error)}</p>
        <Button tone="secondary" onClick={query.retry}>Tải lại gói</Button>
      </Notice>}
      {query.data && groups.size === 0 && <Empty title="Chưa có gói để hiển thị" />}
      {[...groups].map(([cabinType, offers]) => <section className={styles.offerGroup} key={cabinType}>
        <h3>{cabinTypeName(cabinType)}</h3>
        <div className={styles.offerGrid}>{offers.map(offer => <OfferCard key={offer.selection.offerId} offer={offer} />)}</div>
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
    <h2 id="cruise-benefits-heading" tabIndex={-1}>Quyền lợi theo gói du thuyền</h2>
    {query.loading ? <Loading label="Đang tải quyền lợi…" />
      : query.error ? <p>Xem trạng thái tải ở mục Hạng cabin &amp; gói du thuyền.</p>
      : query.data?.offers.length ? <BenefitComparison offers={query.data.offers} />
      : <p>Chưa có quyền lợi được công bố.</p>}
  </section>
}
