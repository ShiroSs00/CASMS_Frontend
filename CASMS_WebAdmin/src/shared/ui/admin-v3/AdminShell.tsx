import { useSessionAccess } from '@/shared/auth'
import { canRoleOpenAdminPath, roleNavigationGroups, staffRoleLabel, type AdminNavigationItem } from './admin-navigation'
import { BrandLogo } from '../BrandLogo'
import { AdminNavigationIcon } from './AdminNavigationIcon'
import { ConnectionNotice } from '../ConnectionNotice'
import { Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import styles from './AdminShell.module.css'
import experience from '../Experience.module.css'
import { AdminAccountContext, AdminRoleContext } from './admin-account-context'

const bookingNavigation = [
  { to: '/admin/bookings', label: 'Danh sách đặt chỗ', icon: 'bookings' },
  { to: '/admin/staff/checkin', label: 'Check-in', icon: 'checkin' },
]

export function AdminShell({ children, className = '', topbar, contextNavigation }: {
  children: ReactNode; className?: string; topbar?: ReactNode
  contextNavigation?: { ariaLabel: string; label: string; description?: string; parentTo?: string; parentHref?: string; parentState?: unknown; items: { label: string; to: string; active: boolean; state?: unknown }[] }
}) {
  const { pathname } = useLocation()
  const access = useSessionAccess()
  const roles=useContext(AdminRoleContext)
  const roleLabel=staffRoleLabel(roles)
  const [menu, setMenu] = useState({ path: pathname, open: false })
  const [navigationQuery, setNavigationQuery] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const menuOpen = menu.path === pathname && menu.open
  useEffect(() => {
    if (!menuOpen) return
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || !menuButton.current?.getClientRects().length) return
      if (event.target instanceof Element && event.target.closest('dialog[open]')) return
      setMenu({ path: pathname, open: false })
      menuButton.current.focus()
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [menuOpen, pathname])
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
  const contextParent = currentGroups.flatMap(group => group.items).find(item => item.to === contextNavigation?.parentTo)
  const contextIdentityMatches = Boolean(contextNavigation && [contextNavigation.label, contextNavigation.description ?? '', contextParent?.label ?? ''].some(value => value.toLocaleLowerCase('vi-VN').includes(query)))
  const contextItems = contextNavigation?.items.filter(item => contextIdentityMatches || item.label.toLocaleLowerCase('vi-VN').includes(query)) ?? []
  const visibleGroups = currentGroups.map(group => ({ ...group, items: group.label.toLocaleLowerCase('vi-VN').includes(query) ? group.items : group.items.filter(item => item.label.toLocaleLowerCase('vi-VN').includes(query) || (item.to === contextParent?.to && contextItems.length > 0)) })).filter(group => group.items.length)
  const selectedContext = contextNavigation?.items.find(item => item.active)
  const bookingWorkspace = roles.length === 1 && roles[0] === 'BOOKING_AGENT' && !contextNavigation
  const bookingLinks = bookingWorkspace
    ? bookingNavigation.filter(item => canRoleOpenAdminPath(roles, item.to, '', access))
    : []
  const bookingSection = bookingLinks.find(item => item.to !== '/admin/bookings' && (pathname === item.to || pathname.startsWith(item.to + '/')))
    ?? bookingLinks.find(item => item.to === activeTo)
  const bookingPageLabel = bookingWorkspace ? ({
    '/admin/bookings/lookup': 'Tra cứu bằng mã',
    '/admin/bookings/cruises': 'Chuyến đang mở bán',
  } as Record<string, string>)[pathname.replace(/\/$/, '')] : undefined
  const pageLabel = selectedContext?.label ?? bookingPageLabel ?? bookingSection?.label ?? activeLabel ?? roleLabel
  const closeMenu = () => setMenu({ path: pathname, open: false })
  const contextContent = contextNavigation && contextItems.length > 0 && <nav className={styles.contextNavigation} aria-label={contextNavigation.ariaLabel}>
    <div className={styles.contextIdentity}><strong>{contextNavigation.label}</strong>{contextNavigation.description && <span>{contextNavigation.description}</span>}</div>
    {contextItems.map(item => <Link key={item.to} to={item.to} state={item.state}
      aria-current={item.active ? 'page' : undefined} className={`${styles.navItem} ${item.active ? styles.active : ''}`}
      onClick={() => { setMenu({ path: pathname, open: false }); requestAnimationFrame(() => document.getElementById('admin-v3-main')?.focus()) }}>{item.label}</Link>)}
  </nav>
  function navigationItem(item: AdminNavigationItem, groupId: string, icon = false) {
    const parent = Boolean(contextParent && item.to === contextParent.to)
    const active = item.to === activeTo && !parent
    return <Fragment key={item.to}><Link to={parent ? contextNavigation?.parentHref ?? item.to! : item.to!} state={parent ? contextNavigation?.parentState : undefined}
      aria-current={active ? 'page' : undefined} className={`${styles.navItem} ${active ? styles.active : ''} ${parent ? styles.contextParent : ''}`}>
      {icon && <AdminNavigationIcon section={groupId} />}<span>{item.label}</span>
    </Link>{parent && contextContent}</Fragment>
  }
  return <div className={`${styles.shell} ${experience.admin} ${bookingWorkspace ? styles.bookingShell : ''} ${className}`.trim()}>
    <a href="#admin-v3-main" className={styles.skipLink}>Chuyển đến nội dung chính</a>
    <header className={styles.masthead} aria-label="Thanh thông tin quản trị">
      <Link to="/admin" className={styles.brand} aria-label="Trang chủ OceVie"><BrandLogo variant="dark" /></Link>
      {topbar ?? <div className={styles.context}><span className={styles.contextEyebrow}>Điều hành OceVie</span><p>{pageLabel}</p></div>}
      {account}
      <div className={styles.mobileBar}><button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenu({ path: pathname, open: !menuOpen })}>{menuOpen ? 'Đóng menu' : 'Mở menu'}</button></div>
    </header>
    <aside id="admin-navigation" className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''} ${contextNavigation ? styles.sidebarContextual : ''}`} aria-label="Điều hướng quản trị">
      <div className={styles.workspaceContext}>{!bookingWorkspace && <span>KHU VỰC LÀM VIỆC</span>}<strong>{roleLabel}</strong></div>
      {!contextParent && contextContent}
      {!bookingWorkspace && <label className={styles.navigationSearch}><span>Tìm chức năng</span><input type="search" value={navigationQuery} onChange={event => setNavigationQuery(event.target.value)} placeholder="Tên chức năng…" /></label>}
      <nav aria-label="Điều hướng khu vực" className={styles.navigation}>
        <div className={styles.navGroup}>{!bookingWorkspace && <p className={styles.groupLabel}>CÔNG VIỆC VÀ TRA CỨU</p>}
          {access.status==='loading' && <p className={styles.unavailable}>Đang kiểm tra quyền truy cập…</p>}
          {bookingWorkspace ? bookingLinks.map(item => <Link key={item.to} to={item.to}
            aria-current={item === bookingSection ? (pathname === item.to ? 'page' : 'location') : undefined}
            className={`${styles.navItem} ${item === bookingSection ? styles.active : ''}`}
            onClick={() => {
              if (menuOpen) {
                closeMenu()
                requestAnimationFrame(() => document.getElementById('admin-v3-main')?.focus())
              }
            }}><AdminNavigationIcon section={item.icon}/><span>{item.label}</span></Link>) : visibleGroups.map(group=>group.items.length===1
            ? group.items.map(item=>navigationItem(item,group.id,true))
            : <details key={group.id} className={styles.menuGroup} open={Boolean(query) || group.items.some(item=>item.to===activeTo)}>
              <summary className={`${styles.menuSummary} ${group.items.some(item=>item.to===activeTo)?styles.menuCurrent:''}`}><AdminNavigationIcon section={group.id} /><span>{group.label}</span><span className={styles.menuChevron} aria-hidden="true">›</span></summary>
              <div className={styles.subMenu}>{group.items.map(item=>navigationItem(item,group.id))}</div>
            </details>)}
          {access.status === 'error' && <div className={styles.unavailable}><p>Chưa tải được quyền truy cập.</p><button type="button" onClick={access.retry}>Thử lại</button></div>}
          {access.status === 'ready' && !(bookingWorkspace ? bookingLinks.length : currentGroups.length) && <p className={styles.unavailable}>Tài khoản chưa được cấp quyền truy cập chức năng.</p>}
          {!bookingWorkspace && query && currentGroups.length > 0 && !visibleGroups.length && <p className={styles.unavailable} role="status">Không tìm thấy chức năng phù hợp.</p>}
        </div>
      </nav>
      <div className={styles.sidebarFooter}><span>OceVie Cruises</span><span>Vietnamese Heritage · Ocean Luxury</span></div>
    </aside>
    <div className={styles.mainColumn}>
      <title>{`OceVie — ${roleLabel}${contextNavigation ? ' / '+contextNavigation.label : ''}${pageLabel!==roleLabel ? ' / '+pageLabel : ''}`}</title>
      <main id="admin-v3-main" tabIndex={-1} className={styles.main}><ConnectionNotice />{children}</main>
    </div>
  </div>
}
