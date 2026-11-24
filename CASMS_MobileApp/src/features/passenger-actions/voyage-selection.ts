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
const rank: Record<PersonalVoyage['cruiseStatus'], number> = { IN_PROGRESS: 0, PUBLISHED: 1, COMPLETED: 2, CANCELLED: 3, DRAFT: 4 };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function restoredVoyageSelection(scope: VoyageScope, saved: unknown) {
  if (!saved || typeof saved !== 'object') return null;
  const { bookingId, bookingPassengerId } = saved as Partial<VoyageSelection>;
  return typeof bookingId === 'string' && uuid.test(bookingId) && typeof bookingPassengerId === 'string' && uuid.test(bookingPassengerId)
    ? { ...scope, bookingId, bookingPassengerId } : null;
}
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
  if (own) return choices.find(row => row.bookingId === own.bookingId && row.bookingPassengerId === own.bookingPassengerId);
  // Use the single best lifecycle match. Equal-priority voyages need an explicit choice.
  const [first, next] = choices;
  return first && (!next || rank[first.cruiseStatus] !== rank[next.cruiseStatus]) ? first : undefined;
}
export function chooseVoyage(scope: VoyageScope, rows: readonly PersonalVoyage[], bookingId: string, passengerId?: string, routeKey?: string) {
  const choices = availableVoyages(rows).filter(row => row.bookingId === bookingId.toLowerCase());
  const previous = scopedSelection(scope, useVoyageSelection.getState().selection);
  const row = passengerId ? choices.find(item => item.bookingPassengerId === passengerId.toLowerCase())
    : choices.find(item => item.bookingPassengerId === previous?.bookingPassengerId) ?? (choices.length === 1 ? choices[0] : undefined);
  if (!row) return false;
  useVoyageSelection.setState(state => ({
    selection: { ...scope, bookingId: row.bookingId, bookingPassengerId: row.bookingPassengerId },
    handledRoutes: routeKey ? { ...state.handledRoutes, [routeKey]: voyageScopeKey(scope) } : state.handledRoutes,
  }));
  return true;
}
