import type { ReactNode, Ref } from 'react'
import { Link } from 'react-router'
import { BookingJourneyProgress } from './BookingJourneyProgress'
import { bookingStageLabels, type BookingStage } from '../model/live-booking-navigation'
import styles from './BookingParty.module.css'

export function BookingFlowLayout({ stage, available, locked, path, back, headingRef, summary, children }: {
  stage: BookingStage; available: number; locked: boolean; path: (stage: number) => string; back: string
  headingRef: Ref<HTMLHeadingElement>; summary: ReactNode; children: ReactNode
}) {
  return <div className={styles.flow} data-booking-redesign>
    <div className={styles.flowTopBar}>
      <Link to={back} className={styles.backLink}>← Về danh mục hành trình</Link>
      <span className={styles.stepCounter}>Bước {stage} / {bookingStageLabels.length}</span>
    </div>
    {/* UX: Main Stepper Workspace (Left) + Sticky Booking & Cost Summary Rail (Right) */}
    <div className={styles.layout}>
      <div className={styles.workspace}>
        <BookingJourneyProgress labels={bookingStageLabels} stage={stage} available={available} locked={locked} path={path} />
        <header className={styles.stepHeader}>
          <h1 ref={headingRef} tabIndex={-1}>{bookingStageLabels[stage - 1]}</h1>
        </header>
        <div className={styles.main}>{children}</div>
      </div>
      <aside className={styles.summary} aria-label="Tóm tắt hành trình đang đặt">{summary}</aside>
    </div>
  </div>
}
