/** Hide duplicate entry points; server authorization remains authoritative. */
export function showStandaloneHandoff(canDispatch: boolean, coordinated: boolean, status: string | undefined, staffingRequestId?: string | null) {
  if (!canDispatch || status && status !== 'RETURNED') return false
  return !coordinated || status === 'RETURNED' && !staffingRequestId
}
