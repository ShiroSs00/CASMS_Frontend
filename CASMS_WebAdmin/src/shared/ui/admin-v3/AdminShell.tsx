import { useSessionAccess } from '@/shared/auth'
import { roleNavigationGroups, staffRoleLabel } from './admin-navigation'
import { BrandLogo } from '../BrandLogo'
import { AdminNavigationIcon } from './AdminNavigationIcon'
import { ConnectionNotice } from '../ConnectionNotice'
import { useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import styles from './AdminShell.module.css'
import experience from '../Experience.module.css'
import { AdminAccountContext, AdminRoleContext } from './admin-account-context'

export function AdminShell({ children, className = '', topbar, contextNavigation }: {
  children: ReactNode; className?: string; topbar?: ReactNode
  contextNavigation?: { ariaLabel: string; label: string; description?: string; items: { label: string; to: string; active: boolean; state?: unknown }[] }
}) {
  const { pathname } = useLocation()
  const access = useSessionAccess()
  const roles=useContext(AdminRoleContext)
  const roleLabel=staffRoleLabel(roles)
  const [menu, setMenu] = useState({ path: pathname, open: false })
  const [navigationQuery, setNavigationQuery] = useState('')
  const menuOpen = menu.path === pathname && menu.open
  const account = useContext(AdminAccountContext)
  const creatingCruise = pathname.replace(/\/$/, '') === '/admin/cruises/new'
  let activeTo = pathname.startsWith('/admin/staff/') ? pathname : pathname.split('/').slice(0,3).join('/')
  if (creatingCruise) activeTo = ''
  else if (pathname.includes('/regulations')) activeTo = pathname.startsWith('/admin/cruises/') ? '/admin/cruises' : pathname.startsWith('/admin/ships/') ? '/admin/ships' : '/admin/regulations'
  else if (pathname.startsWith('/admin/itinerary-history')) activeTo = '/admin/cruises'
  else if (pathname.startsWith('/admin/activity-registrations')) activeTo = '/admin/activity-registrations'
  const currentGroups = roleNavigationGroups(roles,access)
  if(activeTo==='/admin/cabins'&&currentGroups.some(group=>group.items.some(item=>item.to==='/admin/decks'&&item.label==='Boong và phòng'))) activeTo='/admin/decks'
  const activeLabel = creatingCruise ? 'Tạo tour' : currentGroups.flatMap(group => group.items).find(item => item.to === activeTo)?.label
  const query = navigationQuery.trim().toLocaleLowerCase('vi-VN')
  const visibleGroups = currentGroups.map(group => ({ ...group, items: group.label.toLocaleLowerCase('vi-VN').includes(query) ? group.items : group.items.filter(item => item.label.toLocaleLowerCase('vi-VN').includes(query)) })).filter(group => group.items.length)
  return <div className={`${styles.shell} ${experience.admin} ${className}`.trim()}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <header className={styles.masthead} aria-label="Thanh thông tin quản trị">
      <Link to="/admin" className={styles.brand} aria-label="Trang chủ OceVie"><BrandLogo variant="dark" /></Link>
      {topbar ?? <div className={styles.context}><span className={styles.contextEyebrow}>Điều hành OceVie</span><p>{activeLabel ?? roleLabel}</p></div>}
      {account}
      <div className={styles.mobileBar}><button type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenu({ path: pathname, open: !menuOpen })}>{menuOpen ? 'Đóng menu' : 'Mở menu'}</button></div>
    </header>
    <aside id="admin-navigation" className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`} aria-label="Điều hướng quản trị">
      <div className={styles.workspaceContext}><span>KHU VỰC LÀM VIỆC</span><strong>{roleLabel}</strong></div>
      {contextNavigation && <nav className={styles.contextNavigation} aria-label={contextNavigation.ariaLabel}>
        <div className={styles.contextIdentity}><strong>{contextNavigation.label}</strong>{contextNavigation.description && <span>{contextNavigation.description}</span>}</div>
        {contextNavigation.items.map(item => <Link key={item.to} to={item.to} state={item.state}
          aria-current={item.active ? 'page' : undefined} className={`${styles.navItem} ${item.active ? styles.active : ''}`}
          onClick={() => { setMenu({ path: pathname, open: false }); requestAnimationFrame(() => document.getElementById('admin-v3-main')?.focus()) }}>{item.label}</Link>)}
      </nav>}
      <label className={styles.navigationSearch}><span>Tìm chức năng</span><input type="search" value={navigationQuery} onChange={event => setNavigationQuery(event.target.value)} placeholder="Tên chức năng…" /></label>
      <nav aria-label="Điều hướng khu vực" className={styles.navigation}>
        <div className={styles.navGroup}><p className={styles.groupLabel}>CÔNG VIỆC VÀ TRA CỨU</p>
          {access.status==='loading' && <p className={styles.unavailable}>Đang kiểm tra quyền truy cập…</p>}
          {visibleGroups.map(group=>group.items.length===1
            ? group.items.map(item=><Link key={item.to} to={item.to!} aria-current={item.to===activeTo?'page':undefined} className={`${styles.navItem} ${item.to===activeTo?styles.active:''}`}><AdminNavigationIcon section={group.id} /><span>{item.label}</span></Link>)
            : <details key={group.id} className={styles.menuGroup} open={Boolean(query) || group.items.some(item=>item.to===activeTo)}>
              <summary className={`${styles.menuSummary} ${group.items.some(item=>item.to===activeTo)?styles.menuCurrent:''}`}><AdminNavigationIcon section={group.id} /><span>{group.label}</span><span className={styles.menuChevron} aria-hidden="true">›</span></summary>
              <div className={styles.subMenu}>{group.items.map(item=><Link key={item.to} to={item.to!} aria-current={item.to===activeTo?'page':undefined} className={`${styles.navItem} ${item.to===activeTo?styles.active:''}`}>{item.label}</Link>)}</div>
            </details>)}
          {access.status === 'error' && <div className={styles.unavailable}><p>Chưa tải được quyền truy cập.</p><button type="button" onClick={access.retry}>Thử lại</button></div>}
          {access.status === 'ready' && !currentGroups.length && <p className={styles.unavailable}>Tài khoản chưa được cấp quyền truy cập chức năng.</p>}
          {query && currentGroups.length > 0 && !visibleGroups.length && <p className={styles.unavailable} role="status">Không tìm thấy chức năng phù hợp.</p>}
        </div>
      </nav>
      <div className={styles.sidebarFooter}><span>OceVie Cruises</span><span>Vietnamese Heritage · Ocean Luxury</span></div>
    </aside>
    <div className={styles.mainColumn}>
      <title>{`OceVie — ${roleLabel}${activeLabel && activeLabel!==roleLabel ? ' / '+activeLabel : ''}`}</title>
      <main id="admin-v3-main" tabIndex={-1} className={styles.main}><ConnectionNotice />{children}</main>
    </div>
  </div>
}
