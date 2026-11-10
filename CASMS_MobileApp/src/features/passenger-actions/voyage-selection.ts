import { create } from 'zustand';
import type { PersonalVoyage } from './passenger-api';

export type VoyageScope = { owner: string; apiUrl: string; signedInAt: number };
export type VoyageSelection = VoyageScope & { bookingId: string; bookingPassengerId: string };
export const useVoyageSelection = create<{ selection: VoyageSelection | null; handledRoutes: Record<string, string> }>(() => ({ selection: null, handledRoutes: {} }));
export const voyageScopeKey = (scope: VoyageScope | null) => scope ? JSON.stringify([scope.apiUrl, scope.owner, scope.signedInAt]) : '';
export function forgetVoyageRoute(key: string) {
  useVoyageSelection.setState(state => {
    const handledRoutes = { ...state.handledRoutes }; delete handledRoutes[key];
    return { handledRoutes };
  });
}
const rank: Record<string, number> = { IN_PROGRESS: 0, PUBLISHED: 1, COMPLETED: 2, CANCELLED: 3 };
export function availableVoyages(rows: readonly PersonalVoyage[]) {
  return rows.filter(row => row.bookingStatus === 'Confirmed' && row.participationStatus === 'Active')
    .map((row, index) => ({ row, index })).sort((a, b) => (rank[a.row.cruiseStatus] ?? 4) - (rank[b.row.cruiseStatus] ?? 4)
      || (a.row.cruiseStatus === 'COMPLETED' ? b.index - a.index : a.index - b.index)).map(item => item.row);
}
export function scopedSelection(scope: VoyageScope | null, selected: VoyageSelection | null) {
  return scope && selected && selected.owner === scope.owner && selected.apiUrl === scope.apiUrl
    && selected.signedInAt === scope.signedInAt ? selected : null;
}
export function resolveVoyage(scope: VoyageScope | null, selected: VoyageSelection | null, rows: readonly PersonalVoyage[]) {
  if (!scope) return undefined;
  const choices = availableVoyages(rows), own = scopedSelection(scope, selected);
  // Never silently substitute a different passenger when a selected row disappears.
  return own ? choices.find(row => row.bookingId === own.bookingId && row.bookingPassengerId === own.bookingPassengerId) : choices[0];
}
export function chooseVoyage(scope: VoyageScope, rows: readonly PersonalVoyage[], bookingId: string, passengerId?: string, routeKey?: string) {
  const choices = availableVoyages(rows).filter(row => row.bookingId === bookingId.toLowerCase());
  const previous = scopedSelection(scope, useVoyageSelection.getState().selection);
  const row = passengerId ? choices.find(item => item.bookingPassengerId === passengerId.toLowerCase())
    : choices.find(item => item.bookingPassengerId === previous?.bookingPassengerId) ?? choices[0];
  if (!row) return false;
  useVoyageSelection.setState(state => ({
    selection: { ...scope, bookingId: row.bookingId, bookingPassengerId: row.bookingPassengerId },
    handledRoutes: routeKey ? { ...state.handledRoutes, [routeKey]: voyageScopeKey(scope) } : state.handledRoutes,
  }));
  return true;
}
