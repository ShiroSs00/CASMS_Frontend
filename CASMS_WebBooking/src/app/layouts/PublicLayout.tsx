import { externalAppUrl } from '@/shared/lib/external-app'
import { BrandLogo, Button, ConnectionNotice, Modal } from '@/shared/ui'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation, useNavigation } from 'react-router'
import { PublicFooter } from './PublicFooter'
import { PublicContact } from './PublicContact'
import styles from './PublicLayout.module.css'
import experience from '@/shared/ui/Experience.module.css'

const navigationLinks = [
  ['/cruises', 'Chuyến du thuyền'],
  ['/booking/lookup', 'Tra cứu đặt chỗ'],
  ['/destinations', 'Điểm đến'],
  ['/ships', 'Tàu'],
  ['/deals', 'Ưu đãi'],
] as const

export function PublicLayout() {
  const navigation = useNavigation()
  const location = useLocation()
  const [menuLocation, setMenuLocation] = useState<string | null>(null)
  const menuOpen = menuLocation === location.key
  const desktopNav = useRef<HTMLElement>(null)
  const adminUrl = externalAppUrl(import.meta.env.VITE_ADMIN_APP_URL, '/login')

  useEffect(() => {
    if (!menuOpen) return
    const desktop = matchMedia('(min-width: 881px)')
    const closeMenu = () => setMenuLocation(null)
    const closeOnDesktop = () => {
      if (!desktop.matches) return
      closeMenu()
      requestAnimationFrame(() => {
        const nav = desktopNav.current
        const link = nav?.querySelector<HTMLElement>('a[aria-current="page"]') ?? nav?.querySelector('a')
        link?.focus({ preventScroll: true })
      })
    }
    desktop.addEventListener('change', closeOnDesktop)
    window.addEventListener('popstate', closeMenu)
    return () => {
      desktop.removeEventListener('change', closeOnDesktop)
      window.removeEventListener('popstate', closeMenu)
    }
  }, [menuOpen])

  return <div className={`${styles.pageShell} ${experience.booking}`}>
    <title>OceVie — Khám phá hải trình châu Á</title>
    <a className={styles.skipLink} href="#main-content">Chuyển đến nội dung chính</a>
    <header className={styles.header}>
      <div className={styles.brandNav}>
        <NavLink className={styles.brand} to="/" end aria-label="OceVie"><BrandLogo /></NavLink>
        <nav ref={desktopNav} aria-label="Điều hướng chính" className={styles.desktopNav}>
          {navigationLinks.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
          <PublicContact variant="nav" id="nav-contact" />
        </nav>
      </div>
      <div className={styles.accountNav}>
        <PublicContact variant="button" id="header-contact" />
        {adminUrl && <a href={adminUrl} className={styles.loginLink}>Dành cho nhân viên</a>}
        <Button tone="secondary" autoWidth className={styles.menuTrigger} aria-label="Mở menu điều hướng"
          aria-haspopup="dialog" aria-expanded={menuOpen} onClick={event => {
            event.currentTarget.focus({ preventScroll: true })
            setMenuLocation(location.key)
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </Button>
      </div>
      <div className={styles.navigationStatus} role="status">{navigation.state !== 'idle' && <span>Đang chuyển trang…</span>}</div>
    </header>
    {menuOpen && <Modal title="Điều hướng" variant="drawer" protectChanges={false} onClose={() => setMenuLocation(null)}>
      <nav className={styles.drawerNav} aria-label="Điều hướng chính">
        {navigationLinks.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setMenuLocation(null)}>{label}</NavLink>)}
        {adminUrl && <a href={adminUrl}>Dành cho nhân viên</a>}
      </nav>
    </Modal>}
    <main id="main-content" tabIndex={-1}><ConnectionNotice /><Outlet /></main>
    <PublicFooter />
    <ScrollRestoration />
  </div>
}
