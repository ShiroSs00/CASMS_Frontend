import type { ReactNode } from 'react'
import { Link } from 'react-router'
import editorial from '../assets/login-editorial.png'
import expiredEditorial from '../assets/expired-editorial.png'
import styles from './Auth.module.css'

export function AuthPageShell({ children, expired = false, image, editorialTitle = 'Hành trình bắt đầu trước khi lên tàu.', editorialDescription = 'Quản lý booking, thông tin khách và những việc cần hoàn tất trước ngày khởi hành.' }: { children: ReactNode; expired?: boolean; image?: string; editorialTitle?: string; editorialDescription?: string }) {
  return <div className={styles.authPage}>
    <title>AURORA — Tài khoản</title>
    <header className={styles.topbar}><Link className={styles.brand} to="/">AURORA</Link><nav><Link to="/cruises">Khám phá chuyến đi</Link><a href="#auth-help">Trợ giúp</a></nav></header>
    <main className={styles.body}>
      <section className={styles.editorial} aria-label="AURORA Voyages">
        <img src={image ?? (expired ? expiredEditorial : editorial)} alt="Du thuyền AURORA giữa những đảo đá trên vịnh" />
        <div className={styles.overlay} />
        <div className={styles.editorialCopy}><p className={styles.eyebrow}>AURORA VOYAGES</p><h2>{editorialTitle}</h2><p>{editorialDescription}</p></div>
      </section>
      <section className={styles.formZone} aria-label={expired ? 'Phiên đăng nhập hết hạn' : 'Đăng nhập'}>{children}</section>
    </main>
  </div>
}
