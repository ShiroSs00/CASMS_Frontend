import styles from './Cruises.module.css'
import { businessCopy } from '@/shared/i18n/business-copy'

function MilestoneCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.25l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DepartureMilestones({
  creating = false,
  creationStep = 1,
  receivingBookings = false,
  activeStep,
  onStepChange,
  operationsStep,
  onOperationsStepChange,
  canAccessStep2 = true,
  canAccessStep3 = true,
  sourceConfigured = true,
  canReviewPreparation = true,
}: {
  sourceConfigured?: boolean
  creating?: boolean
  creationStep?: 1 | 2 | 3
  receivingBookings?: boolean
  operationsStep?: 1 | 2 | 3
  onOperationsStepChange?: (step: 1 | 2 | 3) => void
  canAccessStep2?: boolean
  canAccessStep3?: boolean
  activeStep?: 2 | 3
  canReviewPreparation?: boolean
  onStepChange?: (step: 2 | 3) => void
}) {
  if (creating) {
    return (
      <ol className={styles.departureMilestones} aria-label="Tạo chuyến khởi hành">
        {(
          [
            [1, 'Chọn lịch trình'],
            [2, 'Ngày khởi hành'],
            [3, 'Kiểm tra và tạo hồ sơ'],
          ] as const
        ).map(([step, label]) => (
          <li key={step} aria-current={creationStep === step ? 'step' : undefined}>
            <span aria-hidden="true">{step}</span>
            {label}
          </li>
        ))}
      </ol>
    )
  }

  if (operationsStep && onOperationsStepChange) {
    const stepItems = [
      { step: 1 as const, label: 'Xét duyệt hồ sơ', locked: false, lockReason: '' },
      { step: 2 as const, label: 'Xác nhận sẵn sàng', locked: !canAccessStep2, lockReason: 'Cần phê duyệt hồ sơ ở Bước 1 trước' },
      { step: 3 as const, label: 'Mở bán', locked: !canAccessStep3, lockReason: 'Cần xác nhận sẵn sàng ở Bước 2 trước' },
    ]
    return (
      <ol
        className={`${styles.departureMilestones} ${styles.interactiveMilestones}`}
        aria-label="Tiến trình xử lý chuyến khởi hành của Quản lý vận hành"
      >
        {stepItems.map(({ step, label, locked, lockReason }) => (
          <li key={step}>
            <button
              type="button"
              disabled={locked}
              title={locked ? lockReason : undefined}
              aria-current={operationsStep === step ? 'step' : undefined}
              onClick={() => {
                if (!locked) onOperationsStepChange(step)
              }}
            >
              <span aria-hidden="true">{step}</span>
              {label}
              {locked && <small> · Chưa mở khóa</small>}
            </button>
          </li>
        ))}
      </ol>
    )
  }

  if (activeStep && onStepChange) {
    return (
      <ol
        className={`${styles.departureMilestones} ${styles.interactiveMilestones}`}
        aria-label="Chuẩn bị và gửi duyệt chuyến khởi hành"
      >
        <li className={styles.completedMilestone}>
          <span aria-hidden="true">
            <MilestoneCheckIcon />
          </span>
          <div>
            <strong>Bước 1: {sourceConfigured ? businessCopy('trip.template.PUBLISHED') : 'Lịch trình nhập trực tiếp'}</strong>
            <small>Đã khởi tạo lịch và tuyến tàu</small>
          </div>
        </li>
        <li>
          <button
            type="button"
            aria-current={activeStep === 2 ? 'step' : undefined}
            onClick={() => onStepChange(2)}
          >
            <span aria-hidden="true">2</span>
            <div>
              <strong>Bước 2: Chuẩn bị hồ sơ</strong>
              <small>Ngân sách, chương trình và gói du thuyền</small>
            </div>
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={!canReviewPreparation}
            aria-current={activeStep === 3 ? 'step' : undefined}
            onClick={() => onStepChange(3)}
          >
            <span aria-hidden="true">3</span>
            <div>
              <strong>Bước 3: Nộp hồ sơ chuyến khởi hành</strong>
              <small>Kiểm tra tổng thể và gửi phê duyệt mở bán</small>
            </div>
          </button>
        </li>
      </ol>
    )
  }

  const current = receivingBookings ? 2 : 1
  return (
    <ol className={styles.departureMilestones} aria-label="Từ lịch trình nguồn đến nhận đặt chỗ">
      <li>
        <span>
          <MilestoneCheckIcon />
        </span>
        {businessCopy('trip.template.PUBLISHED')}
      </li>
      <li aria-current={current === 1 ? 'step' : undefined}>
        <span>{receivingBookings ? <MilestoneCheckIcon /> : '2'}</span>
        {creating ? 'Tạo chuyến khởi hành' : 'Hoàn thiện hồ sơ chuyến khởi hành'}
      </li>
      <li aria-current={current === 2 ? 'step' : undefined}>
        <span>3</span>
        {receivingBookings ? 'Kiểm tra phạm vi nhận đặt chỗ' : 'Nộp hồ sơ cho Vận hành'}
      </li>
    </ol>
  )
}
