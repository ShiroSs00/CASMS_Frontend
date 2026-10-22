import type { ComponentType } from 'react';
import { useAuth } from '@/features/auth/session-store';

/** Reset open dialogs and editable drafts whenever the account/session boundary changes. */
export function AccountBoundScreen({ component: Screen }: { component: ComponentType }) {
  const auth = useAuth();
  return <Screen key={`${auth.status}:${auth.mode}:${auth.session?.user.id ?? 'anonymous'}`} />;
}
