import { useSyncExternalStore } from 'react'
import { authSession } from './model/auth-session'
import { isStaff } from './model/auth-types'

export function useAuth() {
  const state = useSyncExternalStore(authSession.subscribe, authSession.getSnapshot)
  return { ...state, user: state.session?.user ?? null, isStaff: isStaff(state.session?.user), login: authSession.login, logout: authSession.logout }
}
