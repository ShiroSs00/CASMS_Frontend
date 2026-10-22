import haLong from '../assets/ha-long.png'
import styles from './Landing.module.css'
export function HeroSection() {
  return <section className={styles.hero} aria-labelledby="home-title"><img src={haLong} alt="Ảnh minh họa du thuyền giữa cảnh quan vịnh" /><div className={styles.heroShade} /><div className={styles.heroCopy}><p className={styles.eyebrow}>HÀNH TRÌNH OCVVIET</p><h1 id="home-title">Khám phá du thuyền.<br />Tìm nhịp nghỉ của bạn.</h1><p className={styles.heroSubtitle}>Xem hành trình đã công bố, chọn phòng và gửi yêu cầu đặt chỗ. Bắt đầu chuyến đi của bạn mà không cần đăng nhập.</p><div className={styles.heroActions}><a className={styles.primary} href="#cruise-finder">Tìm chuyến</a><a className={styles.secondary} href="#destinations">Cảm hứng điểm đến</a></div><p className={styles.heroCaption}>Ảnh minh họa · Thông tin chuyến đi xem trong danh mục</p></div></section>
}
