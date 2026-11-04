export type IssueIdentity = { code?: string | null; targetType?: string | null; targetId?: string | null; field?: string | null; scope?: string | null }
/** Unknown targets are retained separately. Identical copy alone never identifies an issue. */
export function uniqueOperationsIssues<T extends IssueIdentity>(items: readonly T[], stage: string): T[] {
  const seen = new Set<string>()
  return items.filter((item, index) => {
    const key = JSON.stringify([stage, item.code, item.targetType ?? item.scope, item.targetId, item.field, item.targetId ? null : index])
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}
// Both existing BE gates query ACTIVE_ONBOARD_SQL for the same Cruise. Keep raw codes in the source view.
export const canonicalConditionCode = (code: string) => code === 'MISSING_ONBOARD_STAFF' ? 'ONBOARD_STAFF_REQUIRED' : code
export const uniqueConditionCodes = (codes: readonly string[]) => { const seen = new Set<string>(); return codes.filter(code => { const key = canonicalConditionCode(code); if (seen.has(key)) return false; seen.add(key); return true }) }
