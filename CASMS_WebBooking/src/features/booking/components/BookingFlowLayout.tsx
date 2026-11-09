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
    <div><Link to={back}>Về danh mục hành trình</Link></div>
    <BookingJourneyProgress labels={bookingStageLabels} stage={stage} available={available} locked={locked} path={path} />
    <h1 ref={headingRef} tabIndex={-1}>{bookingStageLabels[stage - 1]}</h1>
    <div className={styles.layout}><div className={styles.main}>{children}</div><aside className={styles.summary}>{summary}</aside></div>
  </div>
}
