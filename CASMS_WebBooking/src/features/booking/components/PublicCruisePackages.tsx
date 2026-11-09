import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { cruisePackageApi } from '@/domain/cruise-package'
import { Badge, Button, Empty, Loading, Notice } from '@/shared/ui'
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

type CatalogOffer = Awaited<ReturnType<typeof cruisePackageApi.available>>['offers'][number]

function OfferCard({ offer }: { offer: CatalogOffer }) {
  const { selection } = offer
  return <article className={styles.offer}>
    <header>
      <p className={styles.offerCategory}>{selection.logicalCategory}</p>
      <h4>{selection.templateName}</h4>
      {selection.templateDescription && <p>{selection.templateDescription}</p>}
    </header>
    <p className={styles.offerPrice}>
      <strong>{selection.amount.replace('.', ',')} {offer.currencyCode}</strong><span> / người</span>
    </p>
    {selection.benefits.length > 0 && <ul className={styles.benefits} aria-label="Quyền lợi của gói">
      {selection.benefits.map(benefit => <li key={benefit.sourceBenefitId}>
        <strong>{benefit.resourceName}</strong>
        <Badge label={inclusionLabels[benefit.inclusion]} tone={benefit.inclusion === 'INCLUDED' ? 'success' : 'neutral'} />
        {benefit.inclusion === 'LIMITED_INCLUDED' && <p>
          Giới hạn: {benefit.quantityLimit} {benefit.usageUnit === 'PARTICIPATION' ? 'lượt tham gia' : benefit.serviceUnitCode ?? 'đơn vị chưa xác định'}.
        </p>}
        {benefit.requiresReservation === true && <><Badge label="Cần đăng ký riêng" tone="warning" /><p>Việc đăng ký tùy theo lịch và số chỗ còn lại.</p></>}
        <p>{benefit.eligibility}</p>
        {benefit.occurrences.length > 0 && <p>Lần phục vụ: {benefit.occurrences.map(item => item.name).join(' · ')}</p>}
        {benefit.usageStartsAt && benefit.usageEndsAt && <p>
          Thời gian sử dụng: {new Date(benefit.usageStartsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
          {' – '}{new Date(benefit.usageEndsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · Giờ Việt Nam
        </p>}
      </li>)}
    </ul>}
  </article>
}

export function PublicCruisePackages({ cruiseId }: { cruiseId: string }) {
  const query = useReadQuery('public-cruise-packages:' + cruiseId,
    useCallback(signal => cruisePackageApi.available(cruiseId, signal), [cruiseId]))
  const groups = new Map<string, CatalogOffer[]>()
  for (const offer of query.data?.offers ?? []) {
    const cabinType = offer.selection.cabinType
    const group = groups.get(cabinType)
    if (group) group.push(offer)
    else groups.set(cabinType, [offer])
  }

  return <section id={cruiseDetailSections.packages} className={styles.section} aria-labelledby="public-packages-heading">
    <div className={styles.sectionHeading}><h2 id="public-packages-heading" tabIndex={-1}>Hạng cabin &amp; gói</h2></div>
    <div className={styles.readResult} aria-live="polite" aria-busy={query.loading}>
      {query.loading && <Loading label="Đang tải hạng cabin và gói…" />}
      {query.error && <Notice title="Chưa tải được hạng cabin và gói" tone="warning">
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
