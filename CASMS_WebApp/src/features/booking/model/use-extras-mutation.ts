import { useRef, useState } from 'react'
import { bookingMutationFailure } from './booking-mutation'

// A transport failure may follow a committed write. Keep the retry lock across
// remount/refresh; list/detail reads remain available for reconciliation.
export function useExtrasMutation(scope: string) {
  const key = 'ocv-extras-uncertain:' + scope
  const [uncertain, setUncertain] = useState(() => { try { return sessionStorage.getItem(key) === '1' } catch { return false } })
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const lock = useRef(false)
  async function run(action: () => Promise<unknown>, success: string, after: () => void) {
    if (lock.current || uncertain) return
    lock.current = true; setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success); after() }
    catch (value) {
      const failure = bookingMutationFailure(value)
      setError(failure.message)
      if (failure.uncertain) { setUncertain(true); try { sessionStorage.setItem(key, '1') } catch { /* In-memory lock remains. */ } }
    } finally { lock.current = false; setBusy(false) }
  }
  return { busy, uncertain, message, error, run }
}
