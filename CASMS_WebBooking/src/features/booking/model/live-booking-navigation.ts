export function catalogReturn(value: string | null) {
  if (!value || !/^\/cruises(?:\?[^#\\]*)?$/.test(value)) return '/cruises'
  return value
}

export const bookingStepPaths = ['/booking/cabin-experience', '/booking/travellers', '/booking/review'] as const
