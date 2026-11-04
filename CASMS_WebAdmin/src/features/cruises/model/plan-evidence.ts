/** Read-only projection of the submitted JSON. Never mutate or hash this projection. */
export type EvidenceRow = Record<string, unknown>
export const evidenceRow = (value: unknown): EvidenceRow => value && typeof value === 'object' && !Array.isArray(value) ? value as EvidenceRow : {}
export const evidenceRows = (value: unknown): EvidenceRow[] => Array.isArray(value) ? value.map(evidenceRow) : []
export const evidenceText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
export const evidenceNumber = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null
const id = (value: unknown): string | null => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null
export type FrozenPackage = { offerId: string | null; templateId: string | null; name: string | null; version: number | null; category: string | null; categoryId: string | null; priceId: string | null; priceRevision: number | null; amount: number | null; currency: string | null; priceUnit: string | null; makers: string[]; benefits: EvidenceRow[]; bindings: EvidenceRow[]; valid: boolean }
export function planEvidence(snapshot: unknown) {
  const source = evidenceRow(snapshot)
  const packages = evidenceRows(source.packageEvidence).map((item): FrozenPackage => {
    const offer = evidenceRow(item.offer), template = evidenceRow(item.template), price = evidenceRow(item.price)
    const offerId = id(offer.offer_id), templateId = id(template.template_version_id), priceId = id(price.price_revision_id)
    const amount = evidenceNumber(price.amount), priceRevision = evidenceNumber(price.revision_number)
    return { offerId, templateId, name: evidenceText(template.name), version: evidenceNumber(template.version_number), category: evidenceText(offer.logical_category), categoryId: id(offer.logical_category_id), priceId, priceRevision, amount, currency: evidenceText(price.currency_code), priceUnit: evidenceText(price.price_unit), makers: [id(price.created_by), id(price.submitted_by)].filter((v): v is string => v !== null), benefits: evidenceRows(item.benefits), bindings: evidenceRows(item.bindings),
      valid: Boolean(offerId && templateId && priceId && evidenceText(template.name) && evidenceText(offer.logical_category) && Number.isSafeInteger(template.version_number) && Number(template.version_number)>0 && offer.cruise_id === evidenceRow(source.cruise).cruise_id && price.offer_id === offerId && offer.template_version_id === templateId && price.template_version_id === templateId && amount !== null && amount >= 0 && priceRevision !== null && Number.isSafeInteger(priceRevision) && priceRevision > 0 && price.currency_code === 'USD' && price.price_unit === 'PERSON') }
  })
  const terms = evidenceRow(source.saleTerms)
  const chargeValid = (value: unknown) => { const c = evidenceRow(value), n = evidenceNumber(c.value); return c.applicability === 'NOT_APPLICABLE' ? Boolean(evidenceText(c.reason)) : c.applicability === 'APPLICABLE' && n !== null && n >= 0 && Boolean(evidenceText(c.evidence)) }
  return { source, packages, terms, hasPackages: Array.isArray(source.packageEvidence), mapping: evidenceText(source.cabinMappingEvidence), valid: Array.isArray(source.packageEvidence) && packages.length > 0 && packages.every(p => p.valid) && chargeValid(terms.tax) && (evidenceRow(terms.tax).applicability !== 'APPLICABLE' || Number(evidenceRow(terms.tax).value)<=1) && chargeValid(terms.portFee) }
}
export function frozenResource(snapshot: unknown, reference: EvidenceRow): { id: string | null; kind: string; name: string | null; row: EvidenceRow } {
  const s = evidenceRow(snapshot)
  for (const [field, group, key, label] of [['onboard_activity_id','activities','activity_name','Hoạt động trên tàu'],['shore_excursion_id','excursions','excursion_name','Tour tham quan'],['service_id','services','service_name','Dịch vụ']] as const) {
    if (reference[field]) { const resource = evidenceRows(s[group]).find(r => r[field] === reference[field]); return { id: evidenceText(reference[field]), kind: label, name: evidenceText(resource?.[key]), row: resource ?? {} } }
  }
  return { id: null, kind: 'Quyền lợi', name: null, row: {} }
}
export function chargeText(value: unknown, tax: boolean) {
  const c = evidenceRow(value), amount = evidenceNumber(c.value)
  if (c.applicability === 'NOT_APPLICABLE') return 'Không áp dụng'
  if (c.applicability !== 'APPLICABLE' || amount === null) return 'Chưa có dữ liệu xác nhận'
  return tax ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(amount * 100)}%` : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(amount)} USD/người`
}
