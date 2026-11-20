import { createContext, useContext } from 'react'
import type { CustomerUser } from './customer-auth-api'

export type CustomerAuthValue = {
  status: 'anonymous' | 'loading' | 'authenticated'
  user: CustomerUser | null
  login: (username: string, password: string) => Promise<CustomerUser>
  logout: () => Promise<void>
}

export const CustomerAuthContext = createContext<CustomerAuthValue | null>(null)

export function useCustomerAuth(): CustomerAuthValue {
  const value = useContext(CustomerAuthContext)
  if (!value) {
    return {
      status: 'anonymous',
      user: null,
      login: async () => {
        throw new Error('Phiên đăng nhập chưa được khởi tạo.')
      },
      logout: async () => undefined,
    }
  }
  return value
}
