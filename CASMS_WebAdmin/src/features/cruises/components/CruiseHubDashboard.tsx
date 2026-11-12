import { journeyTime, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { Badge } from '@/shared/ui'
import type { CruiseDetailView } from '../model/cruise-view'
import { planEvidence } from '../model/plan-evidence'
import type { DepartureSection } from '../model/preparation'
import styles from './CruiseHubDashboard.module.css'

export type HubSalePlanData = {
  planStatus?: string | null
  readyStatus?: string | null
  commercialTermsApproved?: boolean | null
  pricingPolicyStatus?: string | null
  cruisePackagePricing?: boolean | null
  unifiedPackageReview?: boolean | null
  planBlockers?: string[]
  submittedSnapshot?: unknown
}

export type HubSellabilityData = {
  publicSaleState?: string | null
  sellable?: boolean | null
  publicDisplayEligible?: boolean | null
  bookingOpensAt?: string | null
  bookingClosesAt?: string | null
}

export type CruiseHubDashboardProps = {
  detail: CruiseDetailView
  salePlan: {
    data: HubSalePlanData | null | undefined
    loading: boolean
    error: unknown
    retry: () => void
  }
  sellability: {
    data: HubSellabilityData | null | undefined
    loading: boolean
    error: unknown
    retry: () => void
  }
  activeSection: DepartureSection
  onNavigate: (section: DepartureSection) => void
  onOpenStopSale?: () => void
  canStopSale?: boolean
}

export type HubAreaStatus = 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE'

function isBlocked(st: string) {
  return st === 'BLOCKED'
}

function formatTime(isoString?: string | null) {
  if (!isoString) return '—'
  return journeyTime(isoString, SHIP_TIME_ZONE)
}

export function CruiseHubDashboard({
  detail,
  salePlan,
  sellability,
  activeSection,
  onNavigate,
  onOpenStopSale,
  canStopSale = false,
}: CruiseHubDashboardProps) {
  const cruise = detail.cruise
  const planData = salePlan.data
  const sellData = sellability.data

  // 1. Overview & Plan Card
  const isCancelled = cruise.status === 'CANCELLED'
  const planStatus = planData?.planStatus
  let planState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'IN_PROGRESS'
  let planLabel = 'Bản nháp kế hoạch'
  let planTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'info'

  if (salePlan.loading) {
    planState = 'UNAVAILABLE'
    planLabel = 'Đang tải…'
    planTone = 'neutral'
  } else if (isCancelled) {
    planState = 'BLOCKED'
    planLabel = 'Chuyến đã hủy'
    planTone = 'error'
  } else if (planStatus === 'APPROVED' || planData?.readyStatus === 'READY') {
    planState = 'READY'
    planLabel = 'Kế hoạch đã duyệt'
    planTone = 'success'
  } else if (planStatus === 'SUBMITTED') {
    planState = 'PENDING'
    planLabel = 'Chờ duyệt hồ sơ'
    planTone = 'warning'
  } else if (planStatus === 'REVISION_REQUESTED') {
    planState = 'PENDING'
    planLabel = 'Yêu cầu sửa đổi'
    planTone = 'warning'
  } else if (planStatus === 'REJECTED') {
    planState = 'BLOCKED'
    planLabel = 'Hồ sơ bị từ chối'
    planTone = 'error'
  }

  // 2. Itinerary & Preparation Card
  const itinerary = detail.itinerary
  let itinState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'IN_PROGRESS'
  let itinLabel = 'Đang chuẩn bị'
  let itinTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'info'

  if (!itinerary) {
    itinState = 'PENDING'
    itinLabel = 'Chưa có lịch trình'
    itinTone = 'warning'
  } else if (itinerary.status === 'SUSPENDED') {
    itinState = 'BLOCKED'
    itinLabel = 'Lịch trình tạm dừng'
    itinTone = 'error'
  } else if (itinerary.status === 'OPEN_FOR_SALE' || itinerary.status === 'APPROVED') {
    itinState = 'READY'
    itinLabel = itinerary.status === 'OPEN_FOR_SALE' ? 'Áp dụng mở bán' : 'Lịch trình đã duyệt'
    itinTone = 'success'
  } else if (itinerary.status === 'PENDING_APPROVAL') {
    itinState = 'PENDING'
    itinLabel = 'Chờ duyệt lịch'
    itinTone = 'warning'
  }

  // 3. Cruise Packages Card
  const unified = Boolean(planData?.unifiedPackageReview)
  const snapshotPackages = planEvidence(planData?.submittedSnapshot).packages
  let pkgState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'IN_PROGRESS'
  let pkgLabel = unified ? 'Gói hợp nhất' : 'Gói tiêu chuẩn'
  let pkgTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'info'

  if (salePlan.loading) {
    pkgState = 'UNAVAILABLE'
    pkgLabel = 'Đang tải…'
    pkgTone = 'neutral'
  } else if (planData?.readyStatus === 'READY' || (unified && snapshotPackages.length > 0)) {
    pkgState = 'READY'
    pkgLabel = unified ? 'Gói hợp nhất đã chọn' : 'Gói tour sẵn sàng'
    pkgTone = 'success'
  } else if (unified && snapshotPackages.length === 0) {
    pkgState = 'PENDING'
    pkgLabel = 'Chờ chọn gói'
    pkgTone = 'warning'
  }

  // 4. Commercial Terms & Pricing Card
  let priceState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'IN_PROGRESS'
  let priceLabel = 'Đang thiết lập giá'
  let priceTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'info'

  if (salePlan.loading) {
    priceState = 'UNAVAILABLE'
    priceLabel = 'Đang tải…'
    priceTone = 'neutral'
  } else if (planData?.commercialTermsApproved === true || planData?.pricingPolicyStatus === 'APPROVED' || planData?.readyStatus === 'READY') {
    priceState = 'READY'
    priceLabel = 'Điều khoản đã duyệt'
    priceTone = 'success'
  } else if (planData?.cruisePackagePricing === true && !planData?.commercialTermsApproved) {
    priceState = 'PENDING'
    priceLabel = 'Chờ duyệt thuế & phí'
    priceTone = 'warning'
  }

  // 5. Sale Management Card
  const isStopped = Boolean(cruise.stoppedAt)
  const publicSale = sellData?.publicSaleState
  let saleState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'PENDING'
  let saleLabel = 'Chưa mở bán'
  let saleTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'warning'

  if (isStopped || publicSale === 'STOPPED') {
    saleState = 'BLOCKED'
    saleLabel = 'Tạm dừng mở bán'
    saleTone = 'error'
  } else if (sellability.loading) {
    saleState = 'UNAVAILABLE'
    saleLabel = 'Đang kiểm tra…'
    saleTone = 'neutral'
  } else if (publicSale === 'OPEN_FOR_SALE' || (cruise.openedForSaleAt && itinerary?.status === 'OPEN_FOR_SALE')) {
    saleState = 'READY'
    saleLabel = 'Đang mở bán'
    saleTone = 'success'
  } else if (publicSale === 'SOLD_OUT') {
    saleState = 'IN_PROGRESS'
    saleLabel = 'Hết chỗ mở bán'
    saleTone = 'info'
  }

  // 6. Operational Issues Card
  const openIssues = detail.issues.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS')
  const criticalIssues = openIssues.filter((i) => i.severity === 'CRITICAL')
  const blockedChecks = detail.readiness.checks.filter((c) => c.state === 'BLOCKED')

  let issueState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'READY'
  let issueLabel = 'Không có sự cố'
  let issueTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'success'

  if (detail.supplementaryLoading) {
    issueState = 'UNAVAILABLE'
    issueLabel = 'Đang tải…'
    issueTone = 'neutral'
  } else if (criticalIssues.length > 0 || blockedChecks.length > 0) {
    issueState = 'BLOCKED'
    issueLabel = criticalIssues.length
      ? `${criticalIssues.length} sự cố Critical`
      : `${blockedChecks.length} điều kiện Blocker`
    issueTone = 'error'
  } else if (openIssues.length > 0) {
    issueState = 'PENDING'
    issueLabel = `${openIssues.length} sự cố đang mở`
    issueTone = 'warning'
  }

  // 7. Booking & Handoff Card
  const bookedPassengers = detail.capacity.activePassengerCount ?? 0
  const totalCapacity = detail.capacity.shipTotalCapacity ?? 0
  const remainingHeadroom = detail.capacity.remainingPassengerHeadroom

  let bookState: 'READY' | 'PENDING' | 'BLOCKED' | 'IN_PROGRESS' | 'UNAVAILABLE' = 'PENDING'
  let bookLabel = 'Chưa có đặt chỗ'
  let bookTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'warning'

  if (remainingHeadroom != null && remainingHeadroom <= 0 && totalCapacity > 0) {
    bookState = 'IN_PROGRESS'
    bookLabel = 'Đầy chỗ (Full)'
    bookTone = 'info'
  } else if (bookedPassengers > 0) {
    bookState = 'READY'
    bookLabel = `Đã nhận ${bookedPassengers} khách`
    bookTone = 'success'
  }

  return (
    <section className={styles.dashboard} aria-label="Trung tâm tác nghiệp chuyến khởi hành (Hub Dashboard)">
      <div className={styles.hubHeader}>
        <div className={styles.hubTitleGroup}>
          <h2>Trung tâm tác nghiệp chuyến khởi hành (Hub Dashboard)</h2>
          <p>Tổng quan tình trạng 7 nhóm nghiệp vụ để ra quyết định và xử lý công việc.</p>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {/* Card 01: Cruise Overview & Plan */}
        <article
          className={`${styles.card} ${activeSection === 'overview' ? styles.cardActive : ''} ${
            isBlocked(planState) ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>01. Cruise Overview & Plan</h3>
            </div>
            <Badge label={planLabel} tone={planTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Tuyến hành trình:</span>
              <span className={styles.factValue}>
                {detail.departurePort.portName} → {detail.returnPort.portName}
              </span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Khởi hành:</span>
              <span className={styles.factValue}>{formatTime(cruise.departureDatetime)}</span>
            </div>
            <div className={styles.factNote}>
              Hồ sơ: <strong>{planData?.readyStatus === 'READY' ? 'Sẵn sàng vận hành' : planStatus || 'Bản nháp'}</strong>
            </div>
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('overview')}>
              Xem chi tiết hồ sơ →
            </button>
          </footer>
        </article>

        {/* Card 02: Itinerary & Preparation */}
        <article
          className={`${styles.card} ${activeSection === 'schedule' ? styles.cardActive : ''} ${
            isBlocked(itinState) ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>02. Itinerary & Preparation</h3>
            </div>
            <Badge label={itinLabel} tone={itinTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Hải trình:</span>
              <span className={styles.factValue}>
                {itinerary?.dayCount ? `${itinerary.dayCount} ngày` : '—'} ·{' '}
                {itinerary?.portCallCount ? `${itinerary.portCallCount} cảng` : '—'}
              </span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Tàu phân công:</span>
              <span className={styles.factValue}>{detail.ship?.shipName ?? 'Chưa phân công'}</span>
            </div>
            <div className={styles.factNote}>
              Chuẩn bị: <strong>{detail.readiness.checks.length} tiêu chí kiểm tra</strong>
            </div>
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('schedule')}>
              Xem lịch thực tế →
            </button>
          </footer>
        </article>

        {/* Card 03: Cruise Packages */}
        <article
          className={`${styles.card} ${activeSection === 'fare-packages' ? styles.cardActive : ''} ${
            isBlocked(pkgState) ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>03. Cruise Packages</h3>
            </div>
            <Badge label={pkgLabel} tone={pkgTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Mô hình gói:</span>
              <span className={styles.factValue}>{unified ? 'Hợp nhất (Unified)' : 'Gói tour kèm chuyến'}</span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Gói đã duyệt:</span>
              <span className={styles.factValue}>
                {snapshotPackages.length > 0
                  ? `${snapshotPackages.length} gói`
                  : planData?.cruisePackagePricing
                  ? 'Đã cấu hình'
                  : 'Chưa gắn gói'}
              </span>
            </div>
            <div className={styles.factNote}>
              Chính sách: <strong>{unified ? 'Gắn theo hạng Cabin' : 'Gói độc lập'}</strong>
            </div>
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('fare-packages')}>
              Xem gói du thuyền →
            </button>
          </footer>
        </article>

        {/* Card 04: Commercial Terms & Pricing */}
        <article
          className={`${styles.card} ${activeSection === 'transaction-policy' ? styles.cardActive : ''} ${
            isBlocked(priceState) ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>04. Commercial Terms & Pricing</h3>
            </div>
            <Badge label={priceLabel} tone={priceTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Đơn vị tiền tệ:</span>
              <span className={styles.factValue}>USD (Chuẩn hệ thống)</span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Thuế & phí cảng:</span>
              <span className={styles.factValue}>
                {planData?.cruisePackagePricing ? 'Đã cài đặt theo người' : 'Theo chính sách'}
              </span>
            </div>
            <div className={styles.factNote}>
              Phê duyệt: <strong>{planData?.commercialTermsApproved ? 'Đã phê duyệt' : 'Chờ xác nhận OPS'}</strong>
            </div>
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('transaction-policy')}>
              Xem điều khoản giá →
            </button>
          </footer>
        </article>

        {/* Card 05: Sale Management */}
        <article
          className={`${styles.card} ${activeSection === 'checks' ? styles.cardActive : ''} ${
            isBlocked(saleState) ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>05. Sale Management</h3>
            </div>
            <Badge label={saleLabel} tone={saleTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Tình trạng mở bán:</span>
              <span className={styles.factValue}>
                {isStopped ? 'Đã dừng bán' : sellData?.sellable ? 'Đang nhận đặt chỗ' : 'Chưa nhận đặt'}
              </span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Hiển thị website:</span>
              <span className={styles.factValue}>
                {sellData?.publicDisplayEligible ? 'Đang hiển thị' : 'Chưa hiển thị'}
              </span>
            </div>
            {isStopped && (
              <div className={styles.blockedNotice}>
                Lý do dừng: {cruise.stopReason || 'Không có lý do chi tiết'}
              </div>
            )}
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('checks')}>
              Quản lý mở bán →
            </button>
            {canStopSale && !isStopped && (cruise.openedForSaleAt || sellData?.sellable) && onOpenStopSale && (
              <button
                type="button"
                className={styles.quickStopButton}
                onClick={onOpenStopSale}
                title="Tạm dừng mở bán khẩn cấp"
              >
                Dừng bán
              </button>
            )}
          </footer>
        </article>

        {/* Card 06: Operational Issues */}
        <article
          className={`${styles.card} ${activeSection === 'operation' ? styles.cardActive : ''} ${
            issueState === 'BLOCKED' ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>06. Operational Issues</h3>
            </div>
            <Badge label={issueLabel} tone={issueTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Sự cố đang mở:</span>
              <span className={styles.factValue}>{openIssues.length} sự cố</span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Cảnh báo Blocker:</span>
              <span className={styles.factValue}>{blockedChecks.length} điều kiện</span>
            </div>
            {criticalIssues.length > 0 && (
              <div className={styles.blockedNotice}>
                Cảnh báo: Có {criticalIssues.length} sự cố Critical cần giải quyết ngay!
              </div>
            )}
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('operation')}>
              Xem sự cố vận hành →
            </button>
          </footer>
        </article>

        {/* Card 07: Booking & Handoff */}
        <article
          className={`${styles.card} ${activeSection === 'sales' ? styles.cardActive : ''} ${
            isBlocked(bookState) ? styles.cardBlocked : ''
          }`}
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardIdentity}>
              <div className={styles.cardIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className={styles.cardTitle}>07. Booking & Handoff</h3>
            </div>
            <Badge label={bookLabel} tone={bookTone} />
          </header>
          <div className={styles.cardBody}>
            <div className={factRow}>
              <span className={styles.factLabel}>Hành khách / Sức chứa:</span>
              <span className={styles.factValue}>
                {bookedPassengers} / {totalCapacity || '—'} khách
              </span>
            </div>
            <div className={factRow}>
              <span className={styles.factLabel}>Chỗ trống còn lại:</span>
              <span className={styles.factValue}>{remainingHeadroom ?? '—'} chỗ</span>
            </div>
            <div className={styles.factNote}>
              Bàn giao: <strong>Hồ sơ Manifest cho bộ phận Check-in</strong>
            </div>
          </div>
          <footer className={styles.cardFooter}>
            <button type="button" className={styles.actionButton} onClick={() => onNavigate('sales')}>
              Xem danh sách đặt chỗ →
            </button>
          </footer>
        </article>
      </div>
    </section>
  )
}

const factRow = styles.factRow
