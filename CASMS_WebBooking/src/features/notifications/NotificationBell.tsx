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

export function NotificationBell() {
  const access = useSessionAccess()
  const navigate = useNavigate()
  const authenticated = access.status === 'ready' && Boolean(access.userId)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [connected, setConnected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    if (!authenticated) return
    setLoading(true)
    setLoadError('')
    try {
      const data = await apiRequest<NotificationItem[]>('/notifications')
      const list = Array.isArray(data) ? data : []
      setItems(list)
      setUnreadCount(list.filter(item => !item.readAt && !item.read).length)
    } catch {
      setLoadError('Chưa tải được danh sách thông báo lúc này.')
    } finally {
      setLoading(false)
    }
  }, [authenticated])

  useEffect(() => {
    if (!authenticated) return
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let activeController: AbortController | null = null
    let failureCount = 0

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
        if (!res.ok || !res.body) throw new Error('Stream unavailable')
        failureCount = 0
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
                } catch { /* ignore malformed notification payload */ }
              }
              currentEvent = ''
              dataLines = []
            }
          }
        }
      } catch {
        setConnected(false)
        failureCount += 1
      } finally {
        if (!cancelled) {
          const nextDelay = Math.min(30_000, 5_000 * Math.pow(2, Math.max(0, failureCount - 1)))
          void connectSse(nextDelay)
        }
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

  async function acknowledge(id: string) {
    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}/ack`, { method: 'POST' })
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
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: '1px solid #D5E0E4',
          background: '#FFFFFF',
          color: '#0B2A4A',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
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
            maxHeight: '480px',
            display: 'flex',
            flexDirection: 'column',
            background: '#FFFFFF',
            color: '#0B2A4A',
            border: '1px solid #D5E0E4',
            borderRadius: '12px',
            boxShadow: '0 16px 48px rgba(6, 26, 43, 0.18)',
            zIndex: 80,
            overflow: 'hidden',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E5ECEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '15px' }}>Thông báo</strong>
              <span
                title={connected ? 'Đang kết nối cập nhật trực tiếp' : 'Đang kết nối lại…'}
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
            {loadError && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 16px', background: '#FDF4E7', borderBottom: '1px solid #F1DFC0', fontSize: '12px', color: '#7A4300' }} role="status">
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={() => void loadList()}
                  style={{ border: 0, background: 'transparent', color: '#0B2A4A', fontWeight: 600, fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                >
                  Thử lại
                </button>
              </div>
            )}
            {loading && !items.length && (
              <p style={{ padding: '24px 16px', textAlign: 'center', color: '#506777', fontSize: '13px', margin: 0 }}>
                Đang tải thông báo…
              </p>
            )}
            {!loading && !loadError && visibleItems.length === 0 && (
              <p style={{ padding: '28px 16px', textAlign: 'center', color: '#506777', fontSize: '13px', margin: 0 }}>
                {tab === 'unread' ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
              </p>
            )}
            {visibleItems.map(item => {
              const unread = !item.readAt && !item.read
              const needsAck = item.notificationType === 'CRUISE_SCHEDULE_CHANGE' && unread
              const canOpenBookings = ['BOOKING_CREATED', 'CONTRACT_SIGNING_INVITATION', 'PAYMENT_CONFIRMED', 'CRUISE_SCHEDULE_CHANGE'].includes(item.notificationType)
              if (needsAck) {
                return (
                  <div
                    key={item.notificationId}
                    style={{
                      borderBottom: '1px solid #EDF3F1',
                      background: '#F2F8F7',
                      padding: '12px 16px',
                      display: 'grid',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#0B2A4A' }}>{cleanNotificationText(item.title)}</strong>
                      <span role="img" aria-label="Chưa đọc" title="Chưa đọc" style={{ width: '8px', height: '8px', flexShrink: 0, borderRadius: '50%', background: '#0E6B7A' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#506777', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{cleanNotificationText(item.content)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#506777' }}>{formatNotifTime(item.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => void acknowledge(item.notificationId)}
                        style={{
                          border: '1px solid #0B2A4A',
                          background: '#0B2A4A',
                          color: '#FFFFFF',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Xác nhận đã biết
                      </button>
                    </div>
                  </div>
                )
              }
              return (
                <button
                  key={item.notificationId}
                  type="button"
                  onClick={() => {
                    if (unread) void markRead(item.notificationId)
                    if (canOpenBookings) {
                      setOpen(false)
                      void navigate('/my-bookings')
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    borderBottom: '1px solid #EDF3F1',
                    background: unread ? '#F2F8F7' : '#FFFFFF',
                    padding: '12px 16px',
                    cursor: unread || canOpenBookings ? 'pointer' : 'default',
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#0B2A4A' }}>{cleanNotificationText(item.title)}</strong>
                    {unread && <span role="img" aria-label="Chưa đọc" title="Chưa đọc" style={{ width: '8px', height: '8px', flexShrink: 0, borderRadius: '50%', background: '#0E6B7A' }} />}
                  </div>
                  <span style={{ fontSize: '12px', color: '#506777', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{cleanNotificationText(item.content)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#506777' }}>{formatNotifTime(item.createdAt)}</span>
                    {canOpenBookings && <span style={{ fontSize: '12px', fontWeight: 600, color: '#0E6B7A' }}>Xem đặt chỗ →</span>}
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
