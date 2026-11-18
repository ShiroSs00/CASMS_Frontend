import { Link } from 'react-router'
import type { BookingStage } from '../model/live-booking-navigation'
import styles from './BookingParty.module.css'

export function BookingJourneyProgress({ labels, stage, available, locked, path }: {
  labels: readonly string[]; stage: BookingStage; available: number; locked: boolean; path: (stage: number) => string
}) {
  return <nav aria-label="Các bước đặt chỗ"><ol className={styles.progress}>
    {labels.map((label, i) => {
      const stepNumber = i + 1
      const isCurrent = stage === stepNumber
      const isComplete = stepNumber < stage && stepNumber <= available
      const isDisabled = locked || stepNumber > available
      return <li key={label}>
        <Link
          to={path(stepNumber)}
          aria-current={isCurrent ? 'step' : undefined}
          aria-disabled={isDisabled || undefined}
          data-complete={isComplete || undefined}
          tabIndex={isDisabled ? -1 : undefined}
          onClick={event => { if (isDisabled) event.preventDefault() }}
        >
          <span className={styles.stepBar} aria-hidden="true" />
          <span className={styles.stepLabel}>
            <span className={styles.stepIndex} aria-hidden="true">
              {isComplete ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : stepNumber}
            </span>
            <span>{label}</span>
          </span>
        </Link>
      </li>
    })}
  </ol></nav>
}
