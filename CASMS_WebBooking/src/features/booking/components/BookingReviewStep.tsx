import { Link } from 'react-router'
import { Badge, Button, Loading, Notice, Panel } from '@/shared/ui'
import type { CruisePackageCatalog } from '@/domain/cruise-package'
import type { AvailableCabin, BookingCruiseOption, BookingDraft } from '../api/real-booking-api'
import type { BookingQuoteIntent } from '../api/booking-quote-api'
import type { BookingPackageOption } from './LiveBookingFields'
import { groupPassengers } from '../model/booking-party'
import { cabinTypeName } from '../model/booking-presentation'
import { bookingWhen } from '../model/real-booking-view'
import { bookingPlanLabels } from '../model/live-booking-navigation'
import { UsdReference } from './UsdReference'
import styles from './BookingParty.module.css'

function guestInitials(fullName: string, index: number) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `K${index + 1}`
}

const planShortCopy: Record<BookingDraft['paymentPlan'], string> = {
  FULL: '1 lần (100%) · Hạn đóng trong 2 ngày',
  DEPOSIT: '2 đợt: Cọc 30% (trong 2 ngày) · Còn lại 70% trước ngày đi',
  STAGES: '3 đợt: 30% (2 ngày) · 40% (giữa kỳ) · 30% (trước ngày đi)',
}

export function BookingReviewStep({
  draft, cruise, cabins, fares, packages, intent, usable, quoteLoading, quoteError,
  onSelectPlan, onRefreshQuote, path,
}: {
  draft: BookingDraft
  cruise?: BookingCruiseOption
  cabins: AvailableCabin[] | null
  fares?: CruisePackageCatalog | null
  packages: BookingPackageOption[] | null
  intent: BookingQuoteIntent | null
  usable: boolean
  quoteLoading: boolean
  quoteError: string
  onSelectPlan: (plan: BookingDraft['paymentPlan']) => void
  onRefreshQuote: () => void
  path: (stage: number) => string
}) {
  const quote = usable && intent ? intent.quote : null
  const currency = quote?.currency ?? draft.currency
  const fmt = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount)
  const eligiblePlans = quote?.eligiblePaymentPlans?.length ? quote.eligiblePaymentPlans : null
  const milestones = quote?.installments ?? []

  return <div className={styles.section}>
    <Panel title="Thông tin hành trình">
      <div className={styles.reviewHead}>
        <div>
          <h3>{cruise?.cruiseName ?? 'Hành trình của bạn'}</h3>
          <p className={styles.muted}>
            Khởi hành: {bookingWhen(cruise?.departureDatetime)} · Giờ Việt Nam
            {cruise?.shipName ? ` · Tàu ${cruise.shipName}` : ''}
          </p>
        </div>
        <div className={styles.reviewEditLinks}>
          <Link to={path(1)}>Sửa chuyến &amp; số khách</Link>
        </div>
      </div>
    </Panel>

    {groupPassengers(draft.passengers).map(group => <Panel key={group.key} title={`${group.label} · ${group.members.length} hành khách`}>
      <div className={styles.section}>
        <ol className={styles.reviewGuestGrid}>
          {group.members.map(i => {
            const p = draft.passengers[i]
            const fare = fares?.offers.find(o => o.selection.offerId === p.farePackageOfferId)?.selection
            const cabin = cabins?.find(c => c.cabinId === p.cabinId)
            const legacyPack = p.tourPackageId ? packages?.find(pack => pack.id === p.tourPackageId) : undefined
            return <li key={i} className={styles.reviewGuestCard}>
              <div className={styles.reviewGuestTop}>
                <div className={styles.reviewGuestIdentity}>
                  <span className={styles.guestAvatar} aria-hidden="true">{guestInitials(p.fullName, i)}</span>
                  <strong>{p.fullName || `Hành khách ${i + 1}`}</strong>
                  {i === 0 && <span className={styles.leadTag}>Người đại diện</span>}
                </div>
                <Badge
                  label={p.cabinSelectionMode === 'CATEGORY_HOLD'
                    ? 'Giữ chỗ theo hạng'
                    : cabin ? `Cabin ${cabin.cabinNumber}` : 'Cần kiểm tra cabin'}
                  tone={p.cabinSelectionMode === 'CATEGORY_HOLD' ? 'info' : cabin ? 'success' : 'warning'}
                />
              </div>
              <dl className={styles.reviewMetaGrid}>
                {fare && <div>
                  <dt>Gói du thuyền</dt>
                  <dd>{fare.templateName} ({cabinTypeName(fare.cabinType)})</dd>
                </div>}
                {legacyPack && <div>
                  <dt>Gói dịch vụ</dt>
                  <dd>{legacyPack.name}</dd>
                </div>}
                {(p.email || p.phoneNumber) && <div>
                  <dt>Liên hệ</dt>
                  <dd>{[p.email, p.phoneNumber].filter(Boolean).join(' · ')}</dd>
                </div>}
                {p.dateOfBirth && <div>
                  <dt>Ngày sinh</dt>
                  <dd>{p.dateOfBirth}</dd>
                </div>}
                {p.nationality && <div>
                  <dt>Quốc tịch</dt>
                  <dd>{p.nationality}</dd>
                </div>}
                {p.documentNumber && <div>
                  <dt>{p.documentType === 'Passport' ? 'Hộ chiếu' : 'CCCD'}</dt>
                  <dd>••••{p.documentNumber.slice(-4)}</dd>
                </div>}
              </dl>
            </li>
          })}
        </ol>
        <div className={styles.reviewEditLinks}>
          <Link to={path(2)}>Sửa gói &amp; cabin</Link>
          <Link to={path(3)}>Sửa thông tin hành khách</Link>
        </div>
      </div>
    </Panel>)}

    <Panel title="Kế hoạch thanh toán &amp; lộ trình từng đợt">
      <div className={styles.section}>
        <div className={styles.choiceCardGrid} role="group" aria-label="Chọn kế hoạch thanh toán">
          {(Object.entries(bookingPlanLabels) as [BookingDraft['paymentPlan'], string][]).map(([key, label]) => {
            const active = draft.paymentPlan === key
            const disabled = Boolean(eligiblePlans && !eligiblePlans.includes(key))
            return <button
              key={key}
              type="button"
              disabled={disabled || quoteLoading}
              className={`${styles.choiceCard} ${active ? styles.choiceCardActive : ''} ${disabled ? styles.choiceCardDisabled : ''}`}
              aria-pressed={active}
              onClick={() => onSelectPlan(key)}
            >
              <div className={styles.choiceCardHead}>
                <span className={styles.choiceCardTitle}>{label}</span>
                <span className={styles.choiceCardCheck} aria-hidden="true">✓</span>
              </div>
              <span className={styles.choiceCardDesc}>
                {disabled ? 'Không áp dụng do ngày khởi hành quá gần mốc thanh toán.' : planShortCopy[key]}
              </span>
            </button>
          })}
        </div>

        {quoteLoading && <Loading label="Đang tự động tính giá &amp; lịch thanh toán từng đợt…" />}
        {quoteError && !quoteLoading && (
          <Notice title="Chưa tải được báo giá tự động" tone="warning">
            <p>{quoteError}</p>
            <Button tone="secondary" size="compact" autoWidth onClick={onRefreshQuote}>Tính lại báo giá</Button>
          </Notice>
        )}

        {quote && !quoteLoading && <>
          <dl className={styles.quoteBreakdown}>
            {quote.subtotalAmount != null && <div className={styles.quoteRow}>
              <dt>Tạm tính gói du thuyền ({draft.passengers.length} khách)</dt>
              <dd>{fmt(quote.subtotalAmount)}</dd>
            </div>}
            {quote.portFeesAmount != null && <div className={styles.quoteRow}>
              <dt>Phí cảng</dt>
              <dd>{fmt(quote.portFeesAmount)}</dd>
            </div>}
            {quote.taxesAmount != null && <div className={styles.quoteRow}>
              <dt>Thuế áp dụng</dt>
              <dd>{fmt(quote.taxesAmount)}</dd>
            </div>}
            {quote.portFeesAmount == null && quote.taxesAmount == null && quote.taxesAndFeesAmount != null && <div className={styles.quoteRow}>
              <dt>Thuế và phí cảng</dt>
              <dd>{fmt(quote.taxesAndFeesAmount)}</dd>
            </div>}
            <div className={styles.quoteTotalRow}>
              <dt>Tổng tiền đặt chỗ</dt>
              <dd><p className={styles.price}>{fmt(quote.totalAmount ?? 0)}</p></dd>
            </div>
          </dl>
          <UsdReference amount={quote.totalAmount} currency={quote.currency} />

          {milestones.length > 0 && (
            <div role="region" aria-label="Lịch thanh toán từng đợt dự kiến">
              <p className={styles.choiceGroupLabel}>Lịch thanh toán cụ thể ({milestones.length} đợt)</p>
              <ol className={styles.planTimeline}>
                {milestones.map((m, idx) => (
                  <li key={m.sequenceNo} className={`${styles.planMilestone} ${idx === 0 ? styles.planMilestoneFirst : ''}`}>
                    <div className={styles.planMilestoneRail} aria-hidden="true">
                      <span className={styles.planMilestoneNode}>{m.sequenceNo}</span>
                    </div>
                    <div className={styles.planMilestoneBody}>
                      <div className={styles.planMilestoneTitle}>
                        <strong>
                          {m.label}{m.percentage != null ? ` (${m.percentage}%)` : ''}
                        </strong>
                        <span>
                          Hạn thanh toán: <strong>{bookingWhen(m.dueAt)}</strong> · Giờ Việt Nam
                        </span>
                      </div>
                      <div className={styles.planMilestoneAmount}>
                        <strong>{fmt(m.amount)}</strong>
                        <span>{idx === 0 ? 'Cần đóng để giữ cabin' : 'Đóng theo lịch hợp đồng'}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className={styles.planRuleNote}>
                <strong>Lưu ý về giữ chỗ &amp; thanh toán:</strong> Sau khi bấm <em>Xác nhận đặt chỗ</em>, hệ thống giữ cabin tạm thời đến hạn giữ chỗ.
                Hoàn tất <strong>Đợt 1</strong> qua VietQR để xác nhận chính thức; các đợt tiếp theo bạn theo dõi và thanh toán đúng hạn trong mục <em>Đặt chỗ của tôi</em>.
              </p>
            </div>
          )}

          <p className={styles.muted}>Báo giá tự động có hiệu lực đến {bookingWhen(quote.expiresAt ?? undefined)} · Giờ Việt Nam.</p>
        </>}

        {intent && !usable && !quoteLoading && (
          <Notice title="Báo giá vừa hết hiệu lực" tone="warning">
            <p>Lựa chọn hoặc thời hạn báo giá đã thay đổi.</p>
            <Button tone="secondary" size="compact" autoWidth onClick={onRefreshQuote}>Cập nhật lại giá</Button>
          </Notice>
        )}
        {draft.notes && <p className={styles.muted}>Ghi chú của bạn: {draft.notes}</p>}
      </div>
    </Panel>
  </div>
}
