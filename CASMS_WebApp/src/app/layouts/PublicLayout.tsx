import { Link, Outlet } from 'react-router'
import { AuthAccountMenu } from '@/features/auth'
import styles from './PublicLayout.module.css'

export function PublicLayout() {
  return <div className={styles.pageShell}>
    <title>OcvViet — Hành trình trên vịnh</title>
    <a className={styles.skipLink} href="#main-content">Chuyển đến nội dung chính</a>
    <header className={styles.header}><div className={styles.brandNav}><Link className={styles.brand} to="/">OcvViet</Link><nav aria-label="Điều hướng chính"><Link to="/cruises">Chuyến du thuyền</Link><a href="/#destinations">Điểm đến</a><a href="/#experience">Trải nghiệm</a></nav></div><div className={styles.accountNav}><Link to="/booking/lookup">Tra cứu bằng mã</Link><AuthAccountMenu /></div></header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
  </div>
}
