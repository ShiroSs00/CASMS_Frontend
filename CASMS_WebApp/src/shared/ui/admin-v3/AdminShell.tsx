import { useSessionAccess } from '@/shared/auth'
import { adminNavigation, roleNavigationGroups, staffRoleHome, staffRoleLabel } from './admin-navigation'
import { BrandLogo } from '../BrandLogo'
import { useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import styles from './AdminShell.module.css'
import experience from '../Experience.module.css'
import { AdminAccountContext, AdminRoleContext } from './admin-account-context'

export function AdminShell({ children, className = '', topbar }: { children: ReactNode; className?: string; topbar?: ReactNode }) {
  const { pathname, search } = useLocation()
  const access = useSessionAccess()
  const roles=useContext(AdminRoleContext)
  const roleLabel=staffRoleLabel(roles)
  const home=staffRoleHome(roles) ?? '/403'
  const [menu, setMenu] = useState({ path: pathname, open: false })
  const menuOpen = menu.path === pathname && menu.open
  const account = useContext(AdminAccountContext)
  let activeTo = pathname.startsWith('/admin/staff/') ? pathname : pathname.split('/').slice(0,3).join('/')
  if (pathname.includes('/regulations')) activeTo = '/admin/regulations'
  else if (pathname.startsWith('/admin/itinerary-history')) activeTo = '/admin/itineraries'
  else if (pathname.startsWith('/admin/activity-registrations')) activeTo = new URLSearchParams(search).has('excursionId') ? '/admin/shore-excursions' : '/admin/activities'
  const currentGroups = roleNavigationGroups(roles,access)
  if(activeTo==='/admin/cabins'&&currentGroups.some(group=>group.items.some(item=>item.to==='/admin/decks'&&item.label==='Boong & Cabin'))) activeTo='/admin/decks'
  const activeLabel = currentGroups.flatMap(group => group.items).find(item => item.to === activeTo)?.label ?? adminNavigation.flatMap(group => group.items).find(item => item.to === activeTo)?.label
  return <div className={`${styles.shell} ${experience.admin} ${className}`.trim()}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <div className={styles.mobileBar}><BrandLogo /><button type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenu({ path: pathname, open: !menuOpen })}>{menuOpen ? 'Đóng menu' : 'Mở menu'}</button></div>
    <aside id="admin-navigation" className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`} aria-label="Điều hướng quản trị">
      <div className={styles.brand}><BrandLogo variant="dark" /></div>
      <p className={styles.subtitle}>MANAGEMENT SUITE</p>
      <div className={styles.workspaceContext}><span>KHU VỰC LÀM VIỆC</span><strong>{roleLabel}</strong></div>
      <nav aria-label="Điều hướng khu vực" className={styles.navigation}>
        <div className={styles.navGroup}><p className={styles.groupLabel}>CÔNG VIỆC VÀ TRA CỨU</p>
          {access.status==='loading' && <p className={styles.unavailable}>Đang kiểm tra quyền truy cập…</p>}
          {currentGroups.map(group=>group.items.length===1 && (group.direct||group.id==='system'||group.id==='staff/finance'||group.id==='ship-import'||group.id==='ship-models')
            ? group.items.map(item=><Link key={item.to} to={item.to!} aria-current={item.to===activeTo?'page':undefined} className={`${styles.navItem} ${item.to===activeTo?styles.active:''}`}>{item.label}</Link>)
            : <details key={group.id} className={styles.menuGroup} open={group.items.some(item=>item.to===activeTo)}>
              <summary className={`${styles.menuSummary} ${group.items.some(item=>item.to===activeTo)?styles.menuCurrent:''}`}><span>{group.label}</span><span className={styles.menuChevron} aria-hidden="true">›</span></summary>
              <div className={styles.subMenu}>{group.items.map(item=><Link key={item.to} to={item.to!} aria-current={item.to===activeTo?'page':undefined} className={`${styles.navItem} ${item.to===activeTo?styles.active:''}`}>{item.label}</Link>)}</div>
            </details>)}
          {!currentGroups.some(group=>group.items.some(item=>item.to===home)) && <Link to={home} className={styles.navItem}>Khu chức năng của tôi</Link>}
        </div>
      </nav>
      <div className={styles.sidebarFooter}><span>OceVie Cruises</span></div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar} aria-label="Thanh thông tin quản trị">
        {topbar ?? <div className={styles.context}><span className={styles.contextEyebrow}>OceVie / QUẢN TRỊ</span><p>{roleLabel}{activeLabel && activeLabel !== 'Tổng quan' && <><span className={styles.contextDivider} aria-hidden="true">/</span><span className={styles.contextSection}>{activeLabel}</span></>}</p></div>}
        {account}
      </header>
      <title>{`OceVie — ${roleLabel}${activeLabel && activeLabel!==roleLabel ? ' / '+activeLabel : ''}`}</title>
      <main id="admin-v3-main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
  </div>
}
