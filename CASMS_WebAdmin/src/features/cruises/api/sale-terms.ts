import { ApiError, apiRequest } from '@/shared/api'

export type Applicability = 'APPLICABLE' | 'NOT_APPLICABLE'
export type Charge = { applicability: Applicability; value: number | null; reason: string | null; evidence: string | null }
export type Terms = { tax: Charge; portFee: Charge }
export type Action = 'submit' | 'approve' | 'return'
const states = ['MISSING', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED'] as const
export type SaleTerms = { planStatus?: string; revision: number; status: typeof states[number]; terms: Terms | null; submittedBy: string | null; submittedAt: string | null; reviewedAt: string | null }
type History = { actorId: string; action: string; recordedAt: string; evidence: { snapshot: SaleTerms; reason: string } }

const invalid = () => new ApiError('Phản hồi điều kiện mở bán chưa đầy đủ.', 502)
function decode(value: SaleTerms): SaleTerms {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || !states.includes(value.status)) throw invalid()
  if (value.status === 'MISSING') {
    if (value.revision !== 0 || value.terms != null) throw invalid()
  } else {
    const terms = value.terms
    if (!terms || ![terms.tax, terms.portFee].every(charge => charge && (
      charge.applicability === 'APPLICABLE' && typeof charge.value === 'number' && Number.isFinite(charge.value) && charge.value >= 0
      || charge.applicability === 'NOT_APPLICABLE' && charge.value == null && typeof charge.reason === 'string' && charge.reason.trim()
    ))) throw invalid()
    if (terms.tax.value != null && terms.tax.value > 1) throw invalid()
  }
  return value
}
const path = (id: string) => `/cruise-plans/${encodeURIComponent(id)}/commercial-terms/sale`
async function mutate(id: string, revision: number, state: SaleTerms['status'], method: 'PUT' | 'POST', suffix: string, body: object) {
  const saved = decode(await apiRequest<SaleTerms>(path(id) + suffix, { method, body: { ...body, expectedRevision: revision } }))
  if (saved.revision !== revision + 1 || saved.status !== state) throw invalid()
  return saved
}
export const saleTermsApi = {
  read: (id: string, signal?: AbortSignal) => apiRequest<SaleTerms>(path(id), { signal }).then(decode),
  save: (id: string, revision: number, terms: Terms) => mutate(id, revision, 'DRAFT', 'PUT', '', { terms }),
  review: (id: string, revision: number, action: Action, reason: string) =>
    mutate(id, revision, ({ submit: 'PENDING_APPROVAL', approve: 'APPROVED', return: 'RETURNED' } as const)[action], 'POST', '/' + action, { reason }),
  history: async (id: string, signal?: AbortSignal) => {
    const rows = await apiRequest<History[]>(path(id) + '/history', { signal })
    if (!Array.isArray(rows)) throw invalid()
    for (const row of rows) {
      if (!row?.evidence?.snapshot || typeof row.actorId !== 'string' || !Number.isFinite(Date.parse(row.recordedAt))) throw invalid()
      decode(row.evidence.snapshot)
    }
    return rows
  },
}
