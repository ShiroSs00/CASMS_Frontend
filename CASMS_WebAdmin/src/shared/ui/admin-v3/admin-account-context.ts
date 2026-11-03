import { createContext, type ReactNode } from 'react'

// Account behavior is supplied by app composition, keeping shared UI feature-independent.
export const AdminAccountContext = createContext<ReactNode>(null)

export const AdminRoleContext = createContext<readonly string[]>([])
