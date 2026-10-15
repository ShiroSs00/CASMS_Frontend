import haLong from '../assets/ha-long.png'
import styles from './Landing.module.css'

export function HeroSection() {
  return <section className={styles.hero}><img src={haLong} alt="Du thuyền giữa cảnh quan vịnh Hạ Long" /><div className={styles.heroShade} /><div className={styles.heroCopy}><p className={styles.eyebrow}>AURORA VOYAGES</p><h1>Đi xa một chút.<br />Nghỉ sâu hơn một nhịp.</h1><p className={styles.heroSubtitle}>Những hành trình trên vịnh được thiết kế để bạn có thời gian cho cảnh quan, trải nghiệm và chính mình.</p><div className={styles.heroActions}><a className={styles.primary} href="#voyages">Khám phá hành trình</a><a className={styles.secondary} href="#experience">Xem trải nghiệm</a></div></div></section>
}
