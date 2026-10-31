import { BrandLogo, ConnectionNotice } from '@/shared/ui'
import { Link, NavLink, Outlet, ScrollRestoration, useNavigation } from 'react-router'
import { PublicFooter } from './PublicFooter'
import { PublicContact } from './PublicContact'
import styles from './PublicLayout.module.css'
import experience from '@/shared/ui/Experience.module.css'

export function PublicLayout() {
  const navigation = useNavigation()
  return <div className={`${styles.pageShell} ${experience.booking}`}>
    <title>OceVie — Khám phá hải trình châu Á</title>
    <a className={styles.skipLink} href="#main-content">Chuyển đến nội dung chính</a>
    <header className={styles.header}>
      <div className={styles.brandNav}>
        <NavLink className={styles.brand} to="/" end aria-label="OceVie"><BrandLogo /></NavLink>
        <nav aria-label="Điều hướng chính">
          <NavLink to="/cruises">Chuyến du thuyền</NavLink>
          <NavLink to="/booking/lookup">Tra cứu đặt chỗ</NavLink>
          <NavLink to="/destinations">Điểm đến</NavLink>
          <NavLink to="/ships">Tàu & Không gian</NavLink>
          <NavLink to="/deals">Ưu đãi</NavLink>
          <PublicContact variant="nav" id="nav-contact" />
        </nav>
      </div>
      <div className={styles.accountNav}>
        <PublicContact variant="button" id="header-contact" />
        <Link to="/login" className={styles.loginLink}>Đăng nhập</Link>
      </div>
      <div className={styles.navigationStatus} role="status">{navigation.state !== 'idle' && <span>Đang chuyển trang…</span>}</div>
    </header>
    <main id="main-content" tabIndex={-1}><ConnectionNotice /><Outlet /></main>
    <PublicFooter />
    <ScrollRestoration />
  </div>
}
