import { apiRequest } from '@/shared/api'

export type Payment = { paymentId: string; bookingId: string; requestedAmount: number; confirmedAmount?: number | null; currency: string; paymentMethod: 'Cash' | 'GatewaySandbox'; status: 'Pending' | 'Confirmed' | 'Failed' | 'Cancelled'; processorReference?: string | null; internalReceiptReference?: string | null }

function payment(value: unknown, bookingId: string): Payment {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được giao dịch thanh toán.')
  const row = value as Record<string, unknown>
  if (typeof row.paymentId !== 'string' || !row.paymentId || row.bookingId !== bookingId
    || typeof row.requestedAmount !== 'number' || !Number.isFinite(row.requestedAmount) || row.requestedAmount <= 0
    || (row.confirmedAmount != null && (typeof row.confirmedAmount !== 'number' || !Number.isFinite(row.confirmedAmount) || row.confirmedAmount < 0))
    || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)
    || !['Cash', 'GatewaySandbox'].includes(String(row.paymentMethod)) || !['Pending', 'Confirmed', 'Failed', 'Cancelled'].includes(String(row.status))
    || ['processorReference', 'internalReceiptReference'].some(key => row[key] != null && typeof row[key] !== 'string')) throw new Error('Giao dịch không hợp lệ hoặc không thuộc đặt chỗ đã chọn. Tải lại lịch sử trước khi thao tác tiếp.')
  return row as Payment
}

export const paymentApi = {
  list: async (bookingId: string, signal?: AbortSignal) => {
    const rows = await apiRequest<unknown>(`/payment/booking/${encodeURIComponent(bookingId)}`, { signal })
    if (!Array.isArray(rows)) throw new Error('Không đọc được lịch sử giao dịch.')
    const result = rows.map(row => payment(row, bookingId))
    if (new Set(result.map(row => row.paymentId)).size !== result.length) throw new Error('Lịch sử có giao dịch bị lặp. Tải lại để kiểm tra.')
    return result
  },
  create: async (body: { bookingId: string; requestedAmount: number; currency: string; paymentMethod: string; idempotencyKey: string }) => payment(await apiRequest<unknown>('/payment/process', { method: 'POST', body }), body.bookingId),
  confirm: async (row: Payment, reference: string) => {
    const saved = payment(await apiRequest<unknown>(`/payment/${encodeURIComponent(row.paymentId)}/confirm`, { method: 'POST', body: { confirmedAmount: row.requestedAmount, processorReference: reference.trim() } }), row.bookingId)
    if (saved.paymentId !== row.paymentId || saved.status !== 'Confirmed' || saved.currency !== row.currency || saved.confirmedAmount !== row.requestedAmount) throw new Error('Chưa xác nhận được kết quả khoản thu. Tải lại lịch sử để đối chiếu.')
    return saved
  },
}
