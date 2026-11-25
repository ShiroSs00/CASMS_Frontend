import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { startForegroundClock } from './foreground-clock';

/** Expiry labels must update without a tap, including after device suspension. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    return startForegroundClock({
      initialState: AppState.currentState,
      subscribe: listener => { const subscription = AppState.addEventListener('change', listener); return () => subscription.remove(); },
      tick: () => setNow(Date.now()),
      schedule: tick => setInterval(tick, intervalMs),
      cancel: timer => clearInterval(timer as ReturnType<typeof setInterval>),
    });
  }, [intervalMs]);
  return now;
}
