import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { apiRequest, getApiAccessToken, getApiBaseUrl } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

type NotificationItem = {
  notificationId: string
  notificationType: string
  title: string
  content: string
  createdAt: string
  readAt?: string | null
  read?: boolean
}

function cleanNotificationText(text: string) {
  return (text || '').replace(/\*\*(.*?)\*\*/g, '$1').trim()
}

function resolveAdminNotificationTarget(item: NotificationItem, roles: readonly string[]): string | null {
  const type = item.notificationType || ''
  if (type === 'STAFFING_SHIP_MANAGER_NEEDED') {
    return roles.includes('HR_MANAGER') ? '/admin/staffing#ship-manager-assign' : null
  }
  if (type === 'STAFFING_WORKFLOW' || type === 'STAFFING_SENT_TO_HR') {
    if (roles.includes('HR_MANAGER')) return '/admin/staffing'
    if (roles.includes('SHIP_MANAGER')) return '/admin/staffing-reviews'
    if (roles.includes('OPERATIONS_MANAGER')) return '/admin/staffing-reviews'
    if (roles.includes('ACTIVITY_SERVICE_MANAGER')) return '/admin/preparation-requests'
    if (roles.includes('CRUISE_MANAGER')) return '/admin/cruises'
  }
  if (type === 'CRUISE_PLAN_SUBMITTED') {
    return roles.includes('OPERATIONS_MANAGER') ? '/admin/cruise-plan-reviews?mode=tour-dossiers&filter=pending' : '/admin/cruises'
  }
  if (type === 'CRUISE_PLAN_REVISION_REQUESTED' || type === 'CRUISE_PLAN_REJECTED') {
    if (roles.includes('CRUISE_MANAGER')) return '/admin/cruises'
    if (roles.includes('OPERATIONS_MANAGER')) return '/admin/cruise-plan-reviews?mode=tour-dossiers&filter=returned'
  }
  if (type === 'CRUISE_PLAN_APPROVED' || type === 'CRUISE_READY_FOR_SALE' || type === 'CRUISE_OPENED_FOR_SALE') {
    if (roles.includes('CRUISE_MANAGER')) return '/admin/cruises'
    if (roles.includes('SHIP_MANAGER') || roles.includes('ACTIVITY_SERVICE_MANAGER')) return '/admin/preparation-requests'
    if (roles.includes('BOOKING_AGENT')) return '/admin/bookings/cruises'
    if (roles.includes('OPERATIONS_MANAGER')) return '/admin/cruise-plan-reviews?mode=tour-dossiers&filter=reviewed'
  }
  if (type === 'NEW_BOOKING' || type.startsWith('BOOKING_') || type.startsWith('PAYMENT_')) {
    if (roles.includes('FINANCE_OFFICER')) return '/admin/staff/finance'
    if (roles.includes('BOOKING_AGENT')) return '/admin/bookings'
  }
  return null
}

function formatNotifTime(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationBell({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const access = useSessionAccess()
  const navigate = useNavigate()
  const authenticated = access.status === 'ready' && Boolean(access.userId)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    if (!authenticated) return
    setLoading(true)
    try {
      const data = await apiRequest<NotificationItem[]>('/notifications')
      const list = Array.isArray(data) ? data : []
      setItems(list)
      setUnreadCount(list.filter(item => !item.readAt && !item.read).length)
    } catch {
      // keep existing items on transient failure
    } finally {
      setLoading(false)
    }
  }, [authenticated])

  // Initial unread count + real-time SSE stream with auto-reconnect
  useEffect(() => {
    if (!authenticated) return
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let activeController: AbortController | null = null

    void apiRequest<{ unreadCount: number }>('/notifications/unread-count')
      .then(data => { if (!cancelled && typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount) })
      .catch(() => {})

    async function connectSse(delayMs = 0) {
      if (cancelled) return
      if (delayMs > 0) {
        await new Promise(resolve => { reconnectTimer = setTimeout(resolve, delayMs) })
      }
      if (cancelled) return
      const token = getApiAccessToken()
      if (!token) return
      activeController = new AbortController()
      try {
        const res = await fetch(`${getApiBaseUrl()}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: activeController.signal,
        })
        if (!res.ok || !res.body) throw new Error('SSE unavailable')
        setConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''
        let dataLines: string[] = []

        while (!cancelled) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim())
            } else if (line === '') {
              if (dataLines.length) {
                try {
                  const payload = JSON.parse(dataLines.join('\n')) as {
                    unreadCount?: number
                    notification?: NotificationItem
                  }
                  if (typeof payload.unreadCount === 'number') setUnreadCount(payload.unreadCount)
                  if (currentEvent === 'notification' && payload.notification) {
                    const incoming = payload.notification
                    setItems(prev => [incoming, ...prev.filter(x => x.notificationId !== incoming.notificationId)])
                  }
                } catch { /* ignore malformed SSE payload */ }
              }
              currentEvent = ''
              dataLines = []
            }
          }
        }
      } catch {
        setConnected(false)
      } finally {
        if (!cancelled) void connectSse(5000)
      }
    }

    void connectSse(0)
    return () => {
      cancelled = true
      setConnected(false)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      activeController?.abort()
    }
  }, [authenticated])

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markRead(id: string) {
    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
      setItems(prev => prev.map(item => item.notificationId === id ? { ...item, readAt: new Date().toISOString(), read: true } : item))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' })
      const now = new Date().toISOString()
      setItems(prev => prev.map(item => ({ ...item, readAt: item.readAt ?? now, read: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  if (!authenticated) return null

  const visibleItems = tab === 'unread' ? items.filter(i => !i.readAt && !i.read) : items
  const isDark = variant === 'dark'

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) void loadList()
        }}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          border: isDark ? '1px solid rgba(255,255,255,0.22)' : '1px solid #D5E0E4',
          background: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
          color: isDark ? '#F8F6EC' : '#0B2A4A',
          cursor: 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              minWidth: '18px',
              height: '18px',
              padding: '0 5px',
              borderRadius: '999px',
              background: '#B42318',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Hộp thông báo"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(380px, calc(100vw - 24px))',
            maxHeight: '500px',
            display: 'flex',
            flexDirection: 'column',
            background: '#FFFFFF',
            color: '#0B2A4A',
            border: '1px solid #D5E0E4',
            borderRadius: '12px',
            boxShadow: '0 16px 48px rgba(6, 26, 43, 0.18)',
            zIndex: 80,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E5ECEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '15px' }}>Thông báo</strong>
              <span
                title={connected ? 'Đang kết nối thời gian thực (SSE)' : 'Đang kết nối lại…'}
                style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#167347' : '#995700' }}
              />
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                style={{ border: 0, background: 'transparent', color: '#0E6B7A', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', borderBottom: '1px solid #EDF3F1', background: '#F8FAF9' }}>
            {(['all', 'unread'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setTab(mode)}
                style={{
                  border: '1px solid ' + (tab === mode ? '#0B2A4A' : '#D5E0E4'),
                  background: tab === mode ? '#0B2A4A' : '#FFFFFF',
                  color: tab === mode ? '#FFFFFF' : '#506777',
                  borderRadius: '999px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mode === 'all' ? 'Tất cả' : `Chưa đọc (${unreadCount})`}
              </button>
            ))}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && !items.length && (
              <p style={{ padding: '24px 16px', textAlign: 'center', color: '#506777', fontSize: '13px', margin: 0 }}>
                Đang tải thông báo…
              </p>
            )}
            {!loading && visibleItems.length === 0 && (
              <p style={{ padding: '28px 16px', textAlign: 'center', color: '#506777', fontSize: '13px', margin: 0 }}>
                {tab === 'unread' ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
              </p>
            )}
            {visibleItems.map(item => {
              const unread = !item.readAt && !item.read
              const targetPath = resolveAdminNotificationTarget(item, access.roles)
              return (
                <button
                  key={item.notificationId}
                  type="button"
                  onClick={() => {
                    if (unread) void markRead(item.notificationId)
                    if (targetPath) {
                      setOpen(false)
                      void navigate(targetPath)
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    borderBottom: '1px solid #EDF3F1',
                    background: unread ? '#F2F8F7' : '#FFFFFF',
                    padding: '12px 16px',
                    cursor: unread || targetPath ? 'pointer' : 'default',
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#0B2A4A' }}>{cleanNotificationText(item.title)}</strong>
                    {unread && <span role="img" aria-label="Chưa đọc" title="Chưa đọc" style={{ width: '8px', height: '8px', flexShrink: 0, borderRadius: '50%', background: '#0E6B7A' }} />}
                  </div>
                  <span style={{ fontSize: '12px', color: '#506777', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{cleanNotificationText(item.content)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#506777' }}>{formatNotifTime(item.createdAt)}</span>
                    {targetPath && <span style={{ fontSize: '12px', fontWeight: 600, color: '#0E6B7A' }}>Mở xem →</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
