/** Read-only display clocks pause in background and reconcile immediately on resume. */
export function startForegroundClock(options: {
  initialState: string | null | undefined;
  subscribe: (listener: (state: string) => void) => () => void;
  tick: () => void;
  schedule: (tick: () => void) => unknown;
  cancel: (timer: unknown) => void;
}) {
  let timer: unknown, stopped = false, active = false;
  const tick = () => { if (!stopped && active) options.tick(); };
  function change(state: string | null | undefined) {
    if (stopped) return;
    if (timer !== undefined) options.cancel(timer);
    timer = undefined;
    active = state == null || state === 'active';
    if (active) { tick(); timer = options.schedule(tick); }
  }
  const unsubscribe = options.subscribe(change);
  change(options.initialState);
  return () => {
    stopped = true; active = false;
    if (timer !== undefined) options.cancel(timer);
    timer = undefined; unsubscribe();
  };
}
