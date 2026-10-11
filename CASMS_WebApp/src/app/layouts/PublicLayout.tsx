import { NavLink, Outlet } from 'react-router'

import styles from './PublicLayout.module.css'

export function PublicLayout() {
  return (
    <div className={styles.pageShell}>
      <a className={styles.skipLink} href="#main-content">
        Chuyển đến nội dung chính
      </a>

      <header className={styles.header}>
        <NavLink className={styles.brand} to="/" aria-label="CASMS Web — Trang nền tảng">
          <span className={styles.brandMark} aria-hidden="true">
            C
          </span>
          <span>
            <strong>CASMS</strong>
            <small>Web foundation</small>
          </span>
        </NavLink>

        <span className={styles.setupBadge}>WEB-001 · SETUP</span>
      </header>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <span>CASMS Web</span>
        <span>Technical foundation · Product UI chưa được xác nhận</span>
      </footer>
    </div>
  )
}
