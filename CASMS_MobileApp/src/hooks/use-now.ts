import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Expiry labels must update without a tap, including after device suspension. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, intervalMs);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [intervalMs]);
  return now;
}
