import { focusManager } from '@tanstack/react-query';

/** Native has no browser visibility event; resume must revalidate stale queries. */
export function syncAppQueryFocus(state: string | null | undefined, platform: string) {
  if (platform !== 'web' && state && ['active', 'background', 'inactive'].includes(state)) {
    focusManager.setFocused(state === 'active');
  }
}
