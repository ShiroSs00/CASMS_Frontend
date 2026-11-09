import type { Ref } from 'react'
import styles from './BookingExperience.module.css'

export function BookingJourneyBanner({ title, description, step, headingRef }: {
  title: string; description: string; step: number; headingRef: Ref<HTMLHeadingElement>
}) {
  return <header className={styles.copy}><h1 ref={headingRef} tabIndex={-1}>{title}</h1><p>{description}</p><span className={styles.progress}>Bước {step} / 4</span></header>
}

export function BookingPhotoNote() {
  return <figure className={styles.photoNote}><img src="/images/ports/yokohama-osanbashi.webp" alt="Ảnh cảm hứng: cảng Ōsanbashi, Yokohama" loading="lazy" width="1600" height="1000" /><figcaption>Một góc nhìn từ biển.<span>Ảnh cảm hứng · Yokohama, Nhật Bản.</span></figcaption></figure>
}
