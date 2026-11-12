export function cruiseDurationLabel(duration?: { durationDays: number | null; durationNights: number | null } | null) {
  if (!duration) return ''
  const { durationDays, durationNights } = duration
  return [
    durationDays != null && durationDays > 0 ? `${durationDays} ngày` : '',
    durationNights != null && durationNights > 0 ? `${durationNights} đêm` : '',
  ].filter(Boolean).join(' · ')
}
