import { useEffect, type ReactNode } from 'react'
import { authSession } from './model/auth-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => authSession.start(), [])
  return children
}
