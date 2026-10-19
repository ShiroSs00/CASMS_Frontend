export type HomeStatus = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'success' | 'disabled' | 'expired';

export function homeStatusFromParam(value: string | string[] | undefined): HomeStatus {
  const state = Array.isArray(value) ? value[0] : value;
  return state === 'loading' || state === 'empty' || state === 'error' || state === 'offline'
    || state === 'success' || state === 'disabled' || state === 'expired' ? state : 'default';
}

/** Fictional data supplied in the P02 brief. Never a restored session or API response. */
export const demoCruise = {
  passengerName: 'Minh Anh', ship: 'Ocean OceVie', location: 'Vịnh Hạ Long',
  dates: '18–21/10/2026', cabin: '802', package: 'Ocean Comfort',
  spending: '350.000 ₫', lastUpdated: '12/10/2026 · 17:45',
  event: '09:40 · Tập trung tour Việt Hải', eventLocation: 'Sảnh chính · Tầng 1 · Nhóm G03',
} as const;
