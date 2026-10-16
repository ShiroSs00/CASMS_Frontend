import { Link } from 'react-router'
import haLong from '../assets/ha-long.png'
import styles from './Landing.module.css'
export function HeroSection() {
  return <section className={styles.hero}><img src={haLong} alt="Du thuyền giữa cảnh quan vịnh Hạ Long" /><div className={styles.heroShade} /><div className={styles.heroCopy}><p className={styles.eyebrow}>HÀNH TRÌNH TRÊN VỊNH</p><h1>Đi xa một chút.<br />Nghỉ sâu hơn một nhịp.</h1><p className={styles.heroSubtitle}>Khám phá du thuyền Hạ Long, Lan Hạ và Cát Bà với hành trình, cabin và trải nghiệm được kết nối từ lúc tìm chuyến đến ngày khởi hành.</p><div className={styles.heroActions}><Link className={styles.primary} to="/cruises">Tìm chuyến</Link><a className={styles.secondary} href="#destinations">Khám phá điểm đến</a></div></div></section>
}
