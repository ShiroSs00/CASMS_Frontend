export type HomeStatus = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'success' | 'disabled' | 'expired';

export function homeStatusFromParam(value: string | string[] | undefined): HomeStatus {
  const state = Array.isArray(value) ? value[0] : value;
  return state === 'loading' || state === 'empty' || state === 'error' || state === 'offline'
    || state === 'success' || state === 'disabled' || state === 'expired' ? state : 'default';
}

/** Fictional data supplied in the P02 brief. Never a restored session or API response. */
export const demoCruise = {
  passengerName: 'Minh Anh', ship: 'Ocean Aurora', location: 'Vịnh Hạ Long',
  dates: '12–15/10/2026', cabin: '802', package: 'Ocean Comfort',
  spending: '350.000 ₫', lastUpdated: '12/10/2026 · 17:45',
  event: '18:30 · Tiệc chào đón', eventLocation: 'Nhà hàng Ocean · Tầng 3',
} as const;
