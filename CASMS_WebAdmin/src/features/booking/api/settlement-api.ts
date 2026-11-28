import { ApiError, apiRequest } from '@/shared/api'

export type SettlementAccount = { onboardAccountId: string; bookingId: string; cruiseId: string; accountStatus: string; currency: string; settlementStatus: string | null }
export type Settlement = { settlementId: string; accountId: string; baseCurrency: string; totalCharges: number | string; totalRefunds: number | string; totalPayments: number | string; outstandingBalance: number | string; refundDue: number | string; settlementStatus: string; accountStatus: string; startedAt: string; completedAt: string | null; items: { settlementItemId: string; description: string; amount: number | string; currency: string; occurredAt: string }[] }

export function decodeSettlement(result: Settlement, accountId: string): Settlement {
  const decimal = (value: unknown) => typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
  if (!result || result.accountId !== accountId || !result.settlementId
    || !['USD', 'VND'].includes(result.baseCurrency)
    || !['Pending', 'Processing', 'PaymentRequired', 'PartiallyPaid', 'Settled', 'Completed', 'Failed', 'Disputed'].includes(result.settlementStatus)
    || ![result.totalCharges, result.totalRefunds, result.totalPayments, result.outstandingBalance, result.refundDue].every(decimal)
    || !Array.isArray(result.items) || result.items.some(item => !item.settlementItemId || !decimal(item.amount) || !item.currency)) {
    throw new ApiError('Bảng quyết toán không đầy đủ hoặc không khớp tài khoản chi tiêu. Hãy tải lại để đối chiếu.', 502)
  }
  return result
}

export const settlementApi = {
  async account(bookingId: string, signal?: AbortSignal): Promise<SettlementAccount | null> {
    try {
      const account = await apiRequest<SettlementAccount>('/payment/guest/folio/account', { query: { bookingId }, signal })
      if (account.bookingId !== bookingId || !account.onboardAccountId || !account.currency) throw new ApiError('Chưa xác định được tài khoản chi tiêu của đúng đặt chỗ.', 502)
      return account
    } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  },
  async current(accountId: string, signal?: AbortSignal): Promise<Settlement | null> {
    try {
      const result = await apiRequest<Settlement>(`/api/v1/onboard-accounts/${accountId}/settlement`, { signal })
      return decodeSettlement(result, accountId)
    } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error }
  },
  async initiate(account: SettlementAccount): Promise<Settlement> {
    const result = await apiRequest<Settlement>('/api/v1/settlements', { method: 'POST', body: { accountId: account.onboardAccountId } })
    return decodeSettlement(result, account.onboardAccountId)
  },
}
