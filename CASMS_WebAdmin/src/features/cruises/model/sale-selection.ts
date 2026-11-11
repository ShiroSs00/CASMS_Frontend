// Only an explicit Backend legacy/cabin-only decision permits omitting Cruise Package IDs.
export function requiresCruisePackages(unified: boolean | undefined, scope: string, cabinOnlyPermitted: boolean | null | undefined) {
  return !(unified === false && scope === 'CABIN_ONLY' && cabinOnlyPermitted === true)
}
