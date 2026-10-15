import { setApiAccessToken, subscribeApiUnauthorized } from '@/shared/api'
import { authApi } from '../api/auth-api'
import { AUTH_ROLES, type AuthSession, type AuthState } from './auth-types'

const STORAGE_KEY = 'aurora.auth.session.v1'
let state: AuthState = { status: 'loading', session: null }
let generation = 0
let refreshInFlight = false
let loginInFlight = false
let logoutInFlight: Promise<void> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let expiryTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function stopTimers() { clearTimeout(refreshTimer); clearTimeout(expiryTimer) }
function publish(status: AuthState['status'], session: AuthSession | null) {
  setApiAccessToken(session?.accessToken ?? null)
  state = { status, session }
  listeners.forEach((listener) => listener())
}
function clear(status: 'anonymous' | 'expired') {
  generation += 1
  stopTimers()
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* In-memory auth is still cleared. */ }
  publish(status, null)
}
function persist(session: AuthSession) {
  // Do not silently promise browser-session persistence when storage is unavailable.
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  publish('authenticated', session)
  schedule()
}
function restore(): AuthSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const value = JSON.parse(raw) as AuthSession
  if (!value || typeof value.accessToken !== 'string' || !value.accessToken
    || !Number.isFinite(value.expiresAt) || !Number.isFinite(value.refreshAt) || value.refreshAt >= value.expiresAt
    || !value.user || typeof value.user.id !== 'string' || typeof value.user.username !== 'string'
    || !Array.isArray(value.user.roles) || !value.user.roles.every((role) => AUTH_ROLES.includes(role))) {
    throw new Error('Invalid saved session')
  }
  return value
}
function schedule() {
  stopTimers()
  const session = state.session
  if (!session) return
  const remaining = session.expiresAt - Date.now()
  if (remaining <= 0) { clear('expired'); return }
  const maxDelay = 2147483647
  expiryTimer = setTimeout(checkClock, Math.min(remaining, maxDelay))
  refreshTimer = setTimeout(checkClock, Math.min(Math.max(0, session.refreshAt - Date.now()), maxDelay))
}
async function refresh() {
  if (refreshInFlight || logoutInFlight || !state.session) return
  refreshInFlight = true
  const requestGeneration = generation
  try {
    const session = await authApi.refresh()
    if (requestGeneration === generation) persist(session)
  } catch {
    if (requestGeneration === generation) clear('expired')
  } finally {
    refreshInFlight = false
    if (requestGeneration !== generation && state.session && !logoutInFlight) schedule()
  }
}
function checkClock() {
  if (!state.session || logoutInFlight) return
  if (Date.now() >= state.session.expiresAt) clear('expired')
  else if (Date.now() >= state.session.refreshAt) void refresh()
  else schedule()
}

export const authSession = {
  acknowledgeExpiry() { if (state.status === 'expired') publish('anonymous', null) },
  getSnapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  start() {
    try {
      const session = restore()
      if (session && session.expiresAt > Date.now()) { publish('authenticated', session); schedule() }
      else clear(session ? 'expired' : 'anonymous')
    } catch { clear('anonymous') }
    const unsubscribe = subscribeApiUnauthorized(() => { if (state.session) clear('expired') })
    const onVisible = () => { if (document.visibilityState === 'visible') checkClock() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkClock)
    return () => { stopTimers(); unsubscribe(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', checkClock) }
  },
  async login(username: string, password: string) {
    if (loginInFlight || logoutInFlight) throw new Error('Vui lòng chờ thao tác hiện tại hoàn tất.')
    loginInFlight = true
    const requestGeneration = ++generation
    try {
      const session = await authApi.login(username, password)
      if (requestGeneration !== generation) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.')
      persist(session)
      return session.user
    } finally { loginInFlight = false }
  },
  logout() {
    if (logoutInFlight) return logoutInFlight
    generation += 1
    stopTimers()
    logoutInFlight = (async () => {
      try { await authApi.logout() } catch { /* Stateless logout must still clear locally. */ }
      finally { clear('anonymous'); logoutInFlight = null }
    })()
    return logoutInFlight
  },
}
