import { apiRequest, ApiError } from '@/shared/api'
import { decodeCruisePackageOffer, type CruisePackageOffer } from '@/domain/cruise-package'

export type Choice = { offerId: string; priceRevisionId: string }
type Candidate = { product: CruisePackageOffer; eligiblePriceRevisionId: string | null; planEligibility: CruisePackageOffer['eligibility'] }
type Selection = { cruiseId: string; selectionRevision: number; selections: Choice[]; offers: Candidate[] }

export async function planPackages(id: string, signal?: AbortSignal, write?: { expectedSelectionRevision: number; selections: Choice[] }): Promise<Selection> {
  const data = await apiRequest<Selection>(`/cruise-plans/${encodeURIComponent(id)}/cruise-packages`, write ? { method: 'PUT', body: write } : { signal })
  if (data.cruiseId !== id || !Number.isSafeInteger(data.selectionRevision) || data.selectionRevision < 0 || !Array.isArray(data.selections) || !Array.isArray(data.offers))
    throw new ApiError('Không đọc được lựa chọn gói của chuyến.', 502)
  const offers = data.offers.map(candidate => {
    const product = decodeCruisePackageOffer(candidate.product)
    if (product.offer.cruiseId !== id || typeof candidate.planEligibility?.eligible !== 'boolean' || !Array.isArray(candidate.planEligibility.blockers)
      || candidate.eligiblePriceRevisionId != null && !product.prices.some(price => price.id === candidate.eligiblePriceRevisionId))
      throw new ApiError('Gói hoặc phiên bản giá không khớp chuyến.', 502)
    return { ...candidate, product }
  })
  if (write && (data.selectionRevision !== write.expectedSelectionRevision + 1 || data.selections.length !== write.selections.length
    || write.selections.some(choice => !data.selections.some(saved => saved.offerId === choice.offerId && saved.priceRevisionId === choice.priceRevisionId))))
    throw new ApiError('Chưa đối chiếu được lựa chọn đã lưu. Tải lại hồ sơ.', 502)
  return { ...data, offers }
}
