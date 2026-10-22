import { BrandLogo } from '@/shared/ui'
import { Link } from 'react-router'
import styles from './PublicFooter.module.css'

export function PublicFooter() {
  return <footer className={styles.footer} id="help"><div className={styles.footerInner}><div className={styles.footerAbout}><Link to="/" className={styles.brand} aria-label="OceVie"><BrandLogo variant="dark" tagline /></Link><p>Khám phá hành trình đã công bố và chuẩn bị cho chuyến đi của bạn.</p></div><nav aria-label="Khám phá"><span>KHÁM PHÁ</span><Link to="/cruises">Chuyến du thuyền</Link><a href="/#destinations">Cảm hứng điểm đến</a><a href="/#experience">Chuẩn bị trải nghiệm</a></nav><nav aria-label="Đặt chỗ"><span>ĐẶT CHỖ</span><Link to="/booking/lookup">Tra cứu đặt chỗ</Link><a href="#project-contact">Liên hệ</a></nav><nav aria-label="Hướng dẫn"><span>HƯỚNG DẪN</span><a href="/#cruise-finder">Tìm chuyến phù hợp</a><a href="/#journey">Chuẩn bị trước chuyến</a></nav><small>OceVie · 2026 · <Link to="/login">Đăng nhập quản trị</Link> · <a href="/images/ports/credits.html" target="_blank" rel="noreferrer">Nguồn ảnh & giấy phép</a></small></div></footer>
}
