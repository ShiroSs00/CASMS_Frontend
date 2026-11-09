import { Link } from 'react-router'
import { Notice, Panel } from '@/shared/ui'
import type { CruisePackageCatalog } from '@/domain/cruise-package'
import type { AvailableCabin, BookingCruiseOption, BookingDraft } from '../api/real-booking-api'
import type { BookingQuoteIntent } from '../api/booking-quote-api'
import type { BookingPackageOption } from './LiveBookingFields'
import { groupPassengers } from '../model/booking-party'
import { bookingWhen } from '../model/real-booking-view'
import { bookingPlanLabels } from '../model/live-booking-navigation'
import styles from './BookingParty.module.css'

export function BookingReviewStep({ draft, cruise, cabins, fares, packages, intent, usable, path }: {
  draft: BookingDraft; cruise?: BookingCruiseOption; cabins: AvailableCabin[] | null; fares?: CruisePackageCatalog | null
  packages: BookingPackageOption[] | null; intent: BookingQuoteIntent | null; usable: boolean; path: (stage: number) => string
}) {
  return <div className={styles.section}>
    <Panel title={cruise?.cruiseName ?? 'Hành trình của bạn'}><p>{bookingWhen(cruise?.departureDatetime)} · Giờ Việt Nam</p><Link to={path(1)}>Sửa người đi & phòng</Link></Panel>
    {groupPassengers(draft.passengers).map(group => <Panel title={group.label} key={group.key}>
      <ol className={styles.review}>{group.members.map(i => {
        const p = draft.passengers[i], fare = fares?.offers.find(o => o.selection.offerId === p.farePackageOfferId)?.selection
        return <li key={i}><strong>{p.fullName || `Hành khách ${i + 1}`}</strong>
          <p>{p.cabinSelectionMode === 'CATEGORY_HOLD' ? 'Giữ chỗ theo hạng · Chưa phân cabin' : `Cabin ${cabins?.find(c => c.cabinId === p.cabinId)?.cabinNumber ?? 'Cần kiểm tra lại'}`}</p>
          {fare && <p>{fare.templateName} · {fare.logicalCategory}</p>}
          {p.tourPackageId && <p>{packages?.find(pack => pack.id === p.tourPackageId)?.name ?? 'Gói cần kiểm tra lại'}</p>}
          <p>{p.email}{p.phoneNumber ? ` · ${p.phoneNumber}` : ''}</p>
          {p.dateOfBirth && <p>Ngày sinh: {p.dateOfBirth}</p>}{p.nationality && <p>Quốc tịch: {p.nationality}</p>}
          {p.documentNumber && <p>{p.documentType === 'Passport' ? 'Hộ chiếu' : 'CCCD'} · ••••{p.documentNumber.slice(-4)}</p>}
        </li>
      })}</ol><div className={styles.actions}><Link to={path(2)}>Sửa gói & cabin</Link><Link to={path(3)}>Sửa thông tin hành khách</Link></div>
    </Panel>)}
    <Panel title="Kế hoạch thanh toán"><p>{bookingPlanLabels[draft.paymentPlan]}</p>{draft.notes && <p>Ghi chú: {draft.notes}</p>}<Link to={path(3)}>Sửa kế hoạch thanh toán</Link></Panel>
    <Panel title="Giá">{usable && intent ? <><p className={styles.price}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(intent.quote.totalAmount ?? 0)}</p><p>Có hiệu lực đến {bookingWhen(intent.quote.expiresAt ?? undefined)} · Giờ Việt Nam</p></> : <p>Kiểm tra giá để nhận tổng tiền áp dụng cho lựa chọn của bạn.</p>}
      {intent && !usable && <Notice title="Báo giá không còn hiệu lực" tone="warning">Kiểm tra giá lại trước khi xác nhận đặt chỗ.</Notice>}
    </Panel>
  </div>
}
