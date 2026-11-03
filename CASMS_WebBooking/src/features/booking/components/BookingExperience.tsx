import type { Ref } from 'react'
import styles from './BookingExperience.module.css'

export function BookingJourneyBanner({ title, description, step, headingRef }: {
  title: string; description: string; step: number; headingRef: Ref<HTMLHeadingElement>
}) {
  return <header className={styles.banner}>
    <div className={styles.copy}><p className={styles.eyebrow}>OCEVIE / HÀNH TRÌNH CỦA BẠN</p><h1 ref={headingRef} tabIndex={-1}>{title}</h1><p>{description}</p><span className={styles.progress}>BƯỚC {String(step).padStart(2,'0')} / 03</span></div>
    <figure className={styles.cover}><img src="/images/ports/singapore-marina-bay.webp" alt="Ảnh cảm hứng: tàu du lịch tại cảng Marina Bay, Singapore" width="1600" height="1000" /><figcaption>MARINA BAY · ẢNH CẢM HỨNG HẢI TRÌNH</figcaption></figure>
  </header>
}

export function BookingPhotoNote() {
  return <figure className={styles.photoNote}><img src="/images/ports/yokohama-osanbashi.webp" alt="Ảnh cảm hứng: cảng Ōsanbashi, Yokohama" loading="lazy" width="1600" height="1000" /><figcaption>Một góc nhìn từ biển.<span>Ảnh cảm hứng · Yokohama, Nhật Bản.</span></figcaption></figure>
}
