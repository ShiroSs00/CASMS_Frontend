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
  sourceConfigured = true,
  canReviewPreparation = true,
}: {
  sourceConfigured?: boolean
  creating?: boolean
  creationStep?: 1 | 2 | 3
  receivingBookings?: boolean
  operationsStep?: 1 | 2 | 3
  onOperationsStepChange?: (step: 1 | 2 | 3) => void
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
    return (
      <ol
        className={`${styles.departureMilestones} ${styles.interactiveMilestones}`}
        aria-label="Tiến trình xử lý chuyến khởi hành của Quản lý vận hành"
      >
        {(
          [
            [1, 'Xét duyệt hồ sơ'],
            [2, 'Xác nhận sẵn sàng'],
            [3, 'Mở bán'],
          ] as const
        ).map(([step, label]) => (
          <li key={step}>
            <button
              type="button"
              aria-current={operationsStep === step ? 'step' : undefined}
              onClick={() => onOperationsStepChange(step)}
            >
              <span aria-hidden="true">{step}</span>
              {label}
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
              <small>Ngân sách, bộ phận, gói giá & 4 nhóm hồ sơ</small>
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
              <strong>Bước 3: Nộp hồ sơ tour cho Quản lý vận hành</strong>
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
        {receivingBookings ? 'Kiểm tra phạm vi nhận đặt chỗ' : 'Nộp hồ sơ tour cho Vận hành'}
      </li>
    </ol>
  )
}
