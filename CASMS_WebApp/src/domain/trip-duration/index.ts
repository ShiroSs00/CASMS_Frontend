/** Writable Trip duration contract shared by planning and source-linked departures. */
export const durationRules = {
  SHORT: { minDays: 1, maxDays: 2, defaultDays: 1 },
  LONG: { minDays: 3, maxDays: 5, defaultDays: 3 },
} as const
export type DurationGroup = keyof typeof durationRules
export function supportedDuration(code: unknown): code is DurationGroup {
  return typeof code === 'string' && Object.hasOwn(durationRules, code)
}
export function validDurationDays(group: unknown, days: unknown): days is number {
  return supportedDuration(group) && typeof days === 'number' && Number.isSafeInteger(days)
    && days >= durationRules[group].minDays && days <= durationRules[group].maxDays
}
