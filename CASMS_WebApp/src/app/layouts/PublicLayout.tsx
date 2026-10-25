import { BrandLogo, ConnectionNotice } from '@/shared/ui'
import { Link, NavLink, Outlet } from 'react-router'
import { PublicFooter } from './PublicFooter'
import { PublicContact } from './PublicContact'
import styles from './PublicLayout.module.css'
import experience from '@/shared/ui/Experience.module.css'

export function PublicLayout() {
  return <div className={`${styles.pageShell} ${experience.booking}`}>
    <title>OceVie — Khám phá hải trình châu Á</title>
    <a className={styles.skipLink} href="#main-content">Chuyển đến nội dung chính</a>
    <div className={styles.brandLine}><span>VIETNAMESE HERITAGE · OCEAN LUXURY</span><Link to="/login">Không gian nhân sự ↗</Link></div>
    <header className={styles.header}><div className={styles.brandNav}><NavLink className={styles.brand} to="/" end aria-label="OceVie"><BrandLogo /></NavLink><nav aria-label="Điều hướng chính"><NavLink to="/cruises">Chuyến du thuyền</NavLink><a href="/#destinations">Điểm đến</a><a href="/#experience">Trải nghiệm</a></nav></div><div className={styles.accountNav}><Link to="/booking/lookup">Tra cứu bằng mã</Link><PublicContact /></div></header>
    <main id="main-content" tabIndex={-1}><ConnectionNotice /><Outlet /></main>
    <PublicFooter />
  </div>
}
