import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react'
import { Link, NavLink } from 'react-router'

import { AdminFrame } from '@/shared/ui'

import { itineraryStatusLabels, statusTone, type ItineraryStatus } from '../model/itinerary'
import styles from './Itineraries.module.css'

export type IconName =
  | 'anchor'
  | 'arrow-left'
  | 'building'
  | 'calendar'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'compass'
  | 'edit'
  | 'filter'
  | 'history'
  | 'location'
  | 'map'
  | 'more'
  | 'plus'
  | 'publish'
  | 'route'
  | 'save'
  | 'search'
  | 'send'
  | 'ship'
  | 'tour'
  | 'trash'
  | 'users'
  | 'warning'

const iconPaths: Record<IconName, ReactNode> = {
  anchor: <><path d="M12 3v12"/><circle cx="12" cy="4" r="2"/><path d="M5 9H2m20 0h-3M5 9a7 7 0 0 0 14 0M5 9l-3 3m17-3 3 3"/></>,
  'arrow-left': <><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></>,
  building: <><path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  'chevron-down': <path d="m7 10 5 5 5-5"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  filter: <path d="M4 5h16l-6 7v5l-4 2v-7Z"/>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  map: <><path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3Z"/><path d="M8 3v15M16 6v15"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  publish: <><path d="M12 3v12m0-12-4 4m4-4 4 4"/><path d="M5 13v7h14v-7"/></>,
  route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>,
  save: <><path d="M4 4h13l3 3v13H4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  ship: <><path d="M4 10h16l-2 8H6Z"/><path d="M8 10V5h8v5M3 21c2 0 3-1 4-2 1 1 2 2 5 2s4-1 5-2c1 1 2 2 4 2"/></>,
  tour: <><path d="M6 7h12l2 13H4Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8 12h8"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 4a3 3 0 0 1 0 6M17 13c3 .5 4 3 4 6"/></>,
  warning: <><path d="M12 3 2.5 20h19Z"/><path d="M12 9v4M12 17h.01"/></>,
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name]}</svg>
}

export function ItineraryFrame({ children }: { children: ReactNode }) {
  return <AdminFrame className={styles.itineraryShell} topbar={<div className={styles.topbarContent}>
    <div className={styles.topbarContext}><span className={styles.liveDot} /> Trung tâm vận hành <span className={styles.topbarDivider} /> 14 tháng 10, 2026</div>
    <div className={styles.profile}><span className={styles.avatar}>HY</span><span><strong>Hải Yến</strong><small>Điều phối hải trình</small></span><Icon name="chevron-down" /></div>
  </div>}>
    <div className={styles.page}>{children}</div>
  </AdminFrame>
}

export function FeatureNav() {
  const items = [
    { to: '/admin/itineraries', label: 'Hải trình', icon: 'compass' as const, end: true },
    { to: '/admin/itineraries/catalog', label: 'Cảng & điểm đến', icon: 'map' as const, end: false },
    { to: '/admin/itineraries/tours', label: 'Dịch vụ tour bờ', icon: 'tour' as const, end: false },
  ]
  return <nav className={styles.featureNav} aria-label="Nghiệp vụ hải trình">
    {items.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `${styles.featureNavLink} ${isActive ? styles.featureNavLinkActive : ''}`}><Icon name={item.icon} />{item.label}</NavLink>)}
  </nav>
}

export function PageIntro({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className={styles.pageIntro}>
    <div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p className={styles.pageDescription}>{description}</p></div>
    {actions && <div className={styles.pageActions}>{actions}</div>}
  </header>
}

export function ActionButton({ icon, tone = 'primary', compact = false, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; tone?: 'primary' | 'secondary' | 'ghost' | 'danger'; compact?: boolean }) {
  return <button className={`${styles.actionButton} ${styles[`action_${tone}`]} ${compact ? styles.actionCompact : ''} ${className}`} {...props}>{icon && <Icon name={icon} />}{children}</button>
}

export function ActionLink({ to, icon, tone = 'primary', children, compact = false }: { to: string; icon?: IconName; tone?: 'primary' | 'secondary' | 'ghost'; children: ReactNode; compact?: boolean }) {
  return <Link to={to} className={`${styles.actionButton} ${styles[`action_${tone}`]} ${compact ? styles.actionCompact : ''}`}>{icon && <Icon name={icon} />}{children}</Link>
}

export function StatusBadge({ status }: { status: ItineraryStatus }) {
  const tone = statusTone(status)
  return <span className={`${styles.statusBadge} ${styles[`status_${tone}`]}`}><span />{itineraryStatusLabels[status]}</span>
}

export function SimpleStatus({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`${styles.statusBadge} ${styles[`status_${tone}`]}`}><span />{label}</span>
}

export function SectionCard({ title, description, action, children, className = '' }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${styles.sectionCard} ${className}`}>
    {(title || action) && <div className={styles.sectionHeading}><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{action}</div>}
    {children}
  </section>
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className={styles.backLink}><Icon name="arrow-left" />{children}</Link>
}

export function CompletionBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const percentage = max ? Math.round((value / max) * 100) : 0
  return <div className={styles.completion} aria-label={label ?? `${value} trên ${max}`}>
    <div className={styles.completionTrack}><span style={{ width: `${percentage}%` }} /></div>
    <span>{value}/{max}</span>
  </div>
}

export { styles }
