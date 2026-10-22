import { BrandLogo } from '@/shared/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Auth.module.css'

export function AuthPageShell({ children, expired = false, image = '/images/ports/hong-kong-victoria.webp', editorialTitle = 'Hành trình bắt đầu trước khi lên tàu.', editorialDescription = 'Quản lý booking, thông tin khách và những việc cần hoàn tất trước ngày khởi hành.' }: { children: ReactNode; expired?: boolean; image?: string; editorialTitle?: string; editorialDescription?: string }) {
  return <div className={styles.authPage}>
    <title>OceVie — Tài khoản</title>
    <header className={styles.topbar}><Link className={styles.brand} to="/" aria-label="OceVie"><BrandLogo /></Link><nav><Link to="/cruises">Khám phá chuyến đi</Link><a href="#auth-help">Trợ giúp</a></nav></header>
    <main className={styles.body}>
      <section className={styles.editorial} aria-label="OceVie Voyages">
        <img src={image} alt="Cảnh quan bến cảng châu Á" />
        <div className={styles.overlay} />
        <div className={styles.editorialCopy}><p className={styles.eyebrow}>OceVie VOYAGES</p><h2>{editorialTitle}</h2><p>{editorialDescription}</p></div>
        {image === '/images/ports/hong-kong-victoria.webp' && <p className={styles.imageCredit}><a href="https://commons.wikimedia.org/wiki/File:Panorama_of_Hong_Kong_Harbour_from_The_Peak_dllu.jpg" target="_blank" rel="noreferrer">Victoria Harbour · Dllu</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · Cắt khung hiển thị</p>}
      </section>
      <section className={styles.formZone} aria-label={expired ? 'Phiên đăng nhập hết hạn' : 'Đăng nhập'}>{children}</section>
    </main>
  </div>
}
