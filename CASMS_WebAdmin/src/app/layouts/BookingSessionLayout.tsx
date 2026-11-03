import { useState } from 'react'
import { useAuth } from '@/features/auth'
import { BookingProvider } from '@/features/booking'

export function BookingSessionLayout() {
  const owner = useAuth().user?.id ?? null
  const [session, setSession] = useState({ owner, revision: 0 })
  if (session.owner !== owner) {
    // Retire private state before rendering another identity. Guest → sign-in
    // keeps the current draft; logout/account switch also retires late setters.
    setSession({ owner, revision: session.owner === null ? session.revision : session.revision + 1 })
  }
  return <BookingProvider key={session.revision} />
}
