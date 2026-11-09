import { Link } from 'react-router'
import type { BookingStage } from '../model/live-booking-navigation'
import styles from './BookingParty.module.css'

export function BookingJourneyProgress({ labels, stage, available, locked, path }: {
  labels: readonly string[]; stage: BookingStage; available: number; locked: boolean; path: (stage: number) => string
}) {
  return <nav aria-label="Các bước đặt chỗ"><ol className={styles.progress}>
    {labels.map((label, i) => <li key={label}>
      <Link to={path(i + 1)} aria-current={stage === i + 1 ? 'step' : undefined}
        aria-disabled={locked || i + 1 > available || undefined} tabIndex={locked || i + 1 > available ? -1 : undefined}
        onClick={event => { if (locked || i + 1 > available) event.preventDefault() }}>
        <span aria-hidden="true">{i + 1}</span>{label}
      </Link>
    </li>)}
  </ol></nav>
}
