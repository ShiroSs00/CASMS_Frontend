import { ApiError } from '@/shared/api'

export type PricingPolicy = {
  cruiseId: string; pricingPolicyId:string|null;revision:number|null;policyNumber:number|null;submittedBy:string|null;reviewedBy:string|null;decisionReason:string|null;snapshotHash:string|null;policyVersion: string | null; status: 'DRAFT' | 'PENDING_APPROVAL' | 'RETURNED' | 'APPROVED' | 'ARCHIVED' | null
  currency: string | null; interiorBaseFare: number | null; oceanViewBaseFare: number | null
  balconyBaseFare: number | null; suiteBaseFare: number | null; portFeePerPassenger: number | null
  taxRate: number | null; depositPercentage: number | null; finalPaymentDueDays: number | null
  fullPaymentCutoffDays: number | null; cancellationPolicy: string | null; approvedByName: string | null
}

/** Decode source-backed fields without replacing absent prices or terms with defaults. */
export function decodePricingPolicy(value: unknown, cruiseId: string): PricingPolicy {
  const invalid = () => new ApiError('Không đọc được chính sách giá của lần khởi hành này.', 502)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const row = value as Record<string, unknown>
  const text = (key:string) => { const v=row[key]; if(v==null)return null; if(typeof v!=='string')throw invalid(); return v }
  const amount = (key:string) => { const v=row[key]; if(v==null)return null; if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw invalid(); return v }
  const days = (key:string) => { const v=amount(key); if(v!=null&&!Number.isSafeInteger(v))throw invalid(); return v }
  if (text('cruiseId')!==cruiseId) throw invalid()
  const status=text('status')
  if(status!=null&&!['DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','ARCHIVED'].includes(status))throw invalid()
  const currency=text('currency')
  if(currency!=null&&!/^[A-Z]{3}$/.test(currency))throw invalid()
  const taxRate=amount('taxRate'),depositPercentage=amount('depositPercentage')
  if((taxRate!=null&&taxRate>1)||(depositPercentage!=null&&depositPercentage>1))throw invalid()
  return {cruiseId,pricingPolicyId:text('pricingPolicyId'),revision:days('revision'),policyNumber:days('policyNumber'),submittedBy:text('submittedBy'),reviewedBy:text('reviewedBy'),decisionReason:text('decisionReason'),snapshotHash:text('snapshotHash'),policyVersion:text('policyVersion'),status:status as PricingPolicy['status'],currency,
    interiorBaseFare:amount('interiorBaseFare'),oceanViewBaseFare:amount('oceanViewBaseFare'),balconyBaseFare:amount('balconyBaseFare'),suiteBaseFare:amount('suiteBaseFare'),
    portFeePerPassenger:amount('portFeePerPassenger'),taxRate,depositPercentage,finalPaymentDueDays:days('finalPaymentDueDays'),fullPaymentCutoffDays:days('fullPaymentCutoffDays'),cancellationPolicy:text('cancellationPolicy'),approvedByName:text('approvedByName')}
}
