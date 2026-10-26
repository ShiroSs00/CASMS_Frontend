import type { TripInfo } from './plan'

// TripDurationGroup.java at dd256d2. The catalog also advertises MEDIUM/EXTENDED,
// but the request enum cannot accept them yet. Expand here after the BE contract changes.
export const durationRules = {
  SHORT: { minDays: 1, maxDays: 2, defaultDays: 1 },
  LONG: { minDays: 3, maxDays: 5, defaultDays: 3 },
} as const
export function supportedDuration(code:string):code is Exclude<TripInfo['durationBand'], ''> {
  return Object.hasOwn(durationRules,code)
}
