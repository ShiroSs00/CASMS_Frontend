import type { ReactNode } from 'react'
import { Link } from 'react-router'
import editorial from '../assets/login-editorial.png'
import expiredEditorial from '../assets/expired-editorial.png'
import styles from './Auth.module.css'

export function AuthPageShell({ children, expired = false }: { children: ReactNode; expired?: boolean }) {
  return <div className={styles.authPage}>
    <header className={styles.topbar}><Link className={styles.brand} to="/">AURORA</Link><nav><Link to="/#voyages">Khám phá chuyến đi</Link><a href="#auth-help">Trợ giúp</a></nav></header>
    <main className={styles.body}>
      <section className={styles.editorial} aria-label="AURORA Voyages">
        <img src={expired ? expiredEditorial : editorial} alt="Du thuyền AURORA giữa những đảo đá trên vịnh" />
        <div className={styles.overlay} />
        <div className={styles.editorialCopy}><p className={styles.eyebrow}>AURORA VOYAGES</p><h2>Hành trình bắt đầu trước khi lên tàu.</h2><p>Quản lý booking, thông tin khách và những việc cần hoàn tất trước ngày khởi hành.</p></div>
      </section>
      <section className={styles.formZone} aria-label={expired ? 'Phiên đăng nhập hết hạn' : 'Đăng nhập'}>{children}</section>
    </main>
  </div>
}
