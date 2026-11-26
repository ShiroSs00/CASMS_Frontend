import { apiRequest } from '@/shared/api'

export type PaymentMethod = 'Cash' | 'GatewaySandbox' | 'Sepay' | 'CreditCard' | 'TokenizedCard'
export type PaymentStatus =
  | 'Initiated'
  | 'Pending'
  | 'Authorized'
  | 'Captured'
  | 'Confirmed'
  | 'Failed'
  | 'Cancelled'
  | 'PartiallyRefunded'
  | 'Refunded'
export type PaymentOperationType = 'Collect' | 'Void'

export type Payment = {
  paymentId: string
  bookingId: string
  installmentId?: string | null
  sequenceNo?: number | null
  operationType?: PaymentOperationType | string | null
  requestedAmount: number
  confirmedAmount?: number | null
  currency: string
  paymentMethod: PaymentMethod
  provider?: string | null
  status: PaymentStatus
  requestedAt?: string | null
  confirmedAt?: string | null
  processorReference?: string | null
  internalReceiptReference?: string | null
  failureReason?: string | null
  idempotencyKey?: string | null
}

export type SepayTransactionStatus =
  | 'RECEIVED'
  | 'PROCESSED'
  | 'RETRY_REQUIRED'
  | 'UNMATCHED'
  | 'AMOUNT_MISMATCH'
  | 'RECONCILIATION_REQUIRED'
  | 'IGNORED'

export type SepayReconciliationStatus = 'NONE' | 'PENDING_REVIEW' | 'RESOLVED'

export type SepayReconciliationAction =
  | 'APPLY_TO_BOOKING'
  | 'MARK_FOR_REFUND'
  | 'MANUAL_RESOLVED'
  | 'DISMISSED'

export type SepayAuditEntry = {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  actorUserId: string | null
  actorUsername: string | null
  reason: string | null
  evidenceReference: string | null
  relatedBookingId: string | null
  relatedPaymentId: string | null
  createdAt: string
}

export type SepayTransaction = {
  id: string
  sepayId: number
  gateway: string | null
  transactionDate: string | null
  accountNumber: string | null
  transferType: string | null
  transferAmount: number
  currency: string
  expectedAmount: number | null
  varianceAmount: number | null
  code: string | null
  content: string | null
  referenceCode: string | null
  description: string | null
  bookingId: string | null
  bookingReference: string | null
  bookingStatus: string | null
  paymentId: string | null
  paymentReceiptReference: string | null
  status: SepayTransactionStatus
  exceptionCode: string | null
  exceptionReason: string | null
  reconciliationStatus: SepayReconciliationStatus
  reconciliationAction: SepayReconciliationAction | null
  reconciliationReason: string | null
  reconciliationEvidenceRef: string | null
  reconciledByUserId: string | null
  reconciledByUsername: string | null
  reconciledAt: string | null
  matchedAt: string | null
  postedAt: string | null
  retryCount: number
  lastError: string | null
  lastAttemptAt: string | null
  createdAt: string
  auditHistory: SepayAuditEntry[] | null
}

export type SepayReconciliationPage = {
  content: SepayTransaction[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  pendingReviewCount: number
  retryRequiredCount: number
}

const VALID_METHODS: readonly string[] = ['Cash', 'GatewaySandbox', 'Sepay', 'CreditCard', 'TokenizedCard']
const VALID_STATUSES: readonly string[] = [
  'Initiated',
  'Pending',
  'Authorized',
  'Captured',
  'Confirmed',
  'Failed',
  'Cancelled',
  'PartiallyRefunded',
  'Refunded',
]
const VALID_SEPAY_STATUSES: readonly string[] = [
  'RECEIVED',
  'PROCESSED',
  'RETRY_REQUIRED',
  'UNMATCHED',
  'AMOUNT_MISMATCH',
  'RECONCILIATION_REQUIRED',
  'IGNORED',
]
const VALID_RECON_STATUSES: readonly string[] = ['NONE', 'PENDING_REVIEW', 'RESOLVED']

function optionalString(value: unknown, fieldName: string): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error(`Trường ${fieldName} không hợp lệ.`)
  return value
}

function optionalNumber(value: unknown, fieldName: string): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Trường ${fieldName} không hợp lệ.`)
  return value
}

export function decodePayment(value: unknown, bookingId: string): Payment {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được giao dịch thanh toán.')
  const row = value as Record<string, unknown>
  const currency = typeof row.currency === 'string' ? row.currency.trim() : ''
  if (
    typeof row.paymentId !== 'string' || !row.paymentId
    || row.bookingId !== bookingId
    || typeof row.requestedAmount !== 'number' || !Number.isFinite(row.requestedAmount) || row.requestedAmount <= 0
    || (row.confirmedAmount != null && (typeof row.confirmedAmount !== 'number' || !Number.isFinite(row.confirmedAmount) || row.confirmedAmount < 0))
    || !/^[A-Z]{3}$/.test(currency)
    || !VALID_METHODS.includes(String(row.paymentMethod))
    || !VALID_STATUSES.includes(String(row.status))
    || ['processorReference', 'internalReceiptReference', 'provider', 'failureReason', 'idempotencyKey', 'operationType', 'requestedAt', 'confirmedAt'].some(
      key => row[key] != null && typeof row[key] !== 'string',
    )
  ) {
    throw new Error('Giao dịch không hợp lệ hoặc không thuộc đặt chỗ đã chọn. Tải lại lịch sử trước khi thao tác tiếp.')
  }
  return {
    paymentId: row.paymentId,
    bookingId: row.bookingId,
    installmentId: optionalString(row.installmentId, 'installmentId'),
    sequenceNo: optionalNumber(row.sequenceNo, 'sequenceNo'),
    operationType: optionalString(row.operationType, 'operationType'),
    requestedAmount: row.requestedAmount,
    confirmedAmount: row.confirmedAmount == null ? null : Number(row.confirmedAmount),
    currency,
    paymentMethod: row.paymentMethod as PaymentMethod,
    provider: optionalString(row.provider, 'provider'),
    status: row.status as PaymentStatus,
    requestedAt: optionalString(row.requestedAt, 'requestedAt'),
    confirmedAt: optionalString(row.confirmedAt, 'confirmedAt'),
    processorReference: optionalString(row.processorReference, 'processorReference'),
    internalReceiptReference: optionalString(row.internalReceiptReference, 'internalReceiptReference'),
    failureReason: optionalString(row.failureReason, 'failureReason'),
    idempotencyKey: optionalString(row.idempotencyKey, 'idempotencyKey'),
  }
}

/** Chỉ khoản chờ xác nhận thuộc luồng thu thủ công / sandbox (operationType Collect) mới được xác nhận thủ công. */
export function isManualConfirmEligible(row: Payment): boolean {
  const isCollect = !row.operationType || row.operationType === 'Collect'
  return row.status === 'Pending' && isCollect && (row.paymentMethod === 'Cash' || row.paymentMethod === 'GatewaySandbox')
}

/** Tổng hợp tiền đã xác nhận thu theo từng đơn vị tiền tệ, chỉ tính khoản Collect đã Confirmed. */
export function summarizeConfirmedCollectionsByCurrency(rows: readonly Payment[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    const isCollect = !row.operationType || row.operationType === 'Collect'
    if (row.status === 'Confirmed' && isCollect && row.confirmedAmount != null && row.confirmedAmount > 0) {
      totals[row.currency] = (totals[row.currency] ?? 0) + row.confirmedAmount
    }
  }
  return totals
}

function decodeAuditEntry(value: unknown): SepayAuditEntry {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được lịch sử đối soát.')
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.action !== 'string' || typeof row.createdAt !== 'string') {
    throw new Error('Bản ghi nhật ký đối soát không hợp lệ.')
  }
  return {
    id: row.id,
    action: row.action,
    fromStatus: optionalString(row.fromStatus, 'fromStatus'),
    toStatus: optionalString(row.toStatus, 'toStatus'),
    actorUserId: optionalString(row.actorUserId, 'actorUserId'),
    actorUsername: optionalString(row.actorUsername, 'actorUsername'),
    reason: optionalString(row.reason, 'reason'),
    evidenceReference: optionalString(row.evidenceReference, 'evidenceReference'),
    relatedBookingId: optionalString(row.relatedBookingId, 'relatedBookingId'),
    relatedPaymentId: optionalString(row.relatedPaymentId, 'relatedPaymentId'),
    createdAt: row.createdAt,
  }
}

export function decodeSepayTransaction(value: unknown): SepayTransaction {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được giao dịch SePay.')
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' || !row.id
    || typeof row.sepayId !== 'number' || !Number.isFinite(row.sepayId)
    || typeof row.transferAmount !== 'number' || !Number.isFinite(row.transferAmount)
    || !VALID_SEPAY_STATUSES.includes(String(row.status))
    || !VALID_RECON_STATUSES.includes(String(row.reconciliationStatus ?? 'NONE'))
  ) {
    throw new Error('Dữ liệu giao dịch đối soát SePay không hợp lệ.')
  }
  const currency = typeof row.currency === 'string' && row.currency.trim() ? row.currency.trim() : 'VND'
  return {
    id: row.id,
    sepayId: row.sepayId,
    gateway: optionalString(row.gateway, 'gateway'),
    transactionDate: optionalString(row.transactionDate, 'transactionDate'),
    accountNumber: optionalString(row.accountNumber, 'accountNumber'),
    transferType: optionalString(row.transferType, 'transferType'),
    transferAmount: row.transferAmount,
    currency,
    expectedAmount: optionalNumber(row.expectedAmount, 'expectedAmount'),
    varianceAmount: optionalNumber(row.varianceAmount, 'varianceAmount'),
    code: optionalString(row.code, 'code'),
    content: optionalString(row.content, 'content'),
    referenceCode: optionalString(row.referenceCode, 'referenceCode'),
    description: optionalString(row.description, 'description'),
    bookingId: optionalString(row.bookingId, 'bookingId'),
    bookingReference: optionalString(row.bookingReference, 'bookingReference'),
    bookingStatus: optionalString(row.bookingStatus, 'bookingStatus'),
    paymentId: optionalString(row.paymentId, 'paymentId'),
    paymentReceiptReference: optionalString(row.paymentReceiptReference, 'paymentReceiptReference'),
    status: row.status as SepayTransactionStatus,
    exceptionCode: optionalString(row.exceptionCode, 'exceptionCode'),
    exceptionReason: optionalString(row.exceptionReason, 'exceptionReason'),
    reconciliationStatus: (row.reconciliationStatus ?? 'NONE') as SepayReconciliationStatus,
    reconciliationAction: optionalString(row.reconciliationAction, 'reconciliationAction') as SepayReconciliationAction | null,
    reconciliationReason: optionalString(row.reconciliationReason, 'reconciliationReason'),
    reconciliationEvidenceRef: optionalString(row.reconciliationEvidenceRef, 'reconciliationEvidenceRef'),
    reconciledByUserId: optionalString(row.reconciledByUserId, 'reconciledByUserId'),
    reconciledByUsername: optionalString(row.reconciledByUsername, 'reconciledByUsername'),
    reconciledAt: optionalString(row.reconciledAt, 'reconciledAt'),
    matchedAt: optionalString(row.matchedAt, 'matchedAt'),
    postedAt: optionalString(row.postedAt, 'postedAt'),
    retryCount: typeof row.retryCount === 'number' && Number.isFinite(row.retryCount) ? row.retryCount : 0,
    lastError: optionalString(row.lastError, 'lastError'),
    lastAttemptAt: optionalString(row.lastAttemptAt, 'lastAttemptAt'),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    auditHistory: Array.isArray(row.auditHistory) ? row.auditHistory.map(decodeAuditEntry) : null,
  }
}

export const paymentApi = {
  list: async (bookingId: string, signal?: AbortSignal) => {
    const rows = await apiRequest<unknown>(`/payment/booking/${encodeURIComponent(bookingId)}`, { signal })
    if (!Array.isArray(rows)) throw new Error('Không đọc được lịch sử giao dịch.')
    const result = rows.map(row => decodePayment(row, bookingId))
    if (new Set(result.map(row => row.paymentId)).size !== result.length) {
      throw new Error('Lịch sử có giao dịch bị lặp. Tải lại để kiểm tra.')
    }
    return result
  },
  create: async (body: { bookingId: string; requestedAmount: number; currency: string; paymentMethod: string; idempotencyKey: string }) => {
    if (!['USD', 'VND'].includes(body.currency)) throw new Error('Cần đối chiếu đơn vị tiền tệ của đặt chỗ.')
    return decodePayment(await apiRequest<unknown>('/payment/process', { method: 'POST', body }), body.bookingId)
  },
  confirm: async (row: Payment, reference: string) => {
    if (!isManualConfirmEligible(row)) {
      throw new Error('Chỉ được xác nhận thủ công cho khoản thu tiền mặt hoặc sandbox đang chờ xác nhận.')
    }
    const saved = decodePayment(
      await apiRequest<unknown>(`/payment/${encodeURIComponent(row.paymentId)}/confirm`, {
        method: 'POST',
        body: { confirmedAmount: row.requestedAmount, processorReference: reference.trim() },
      }),
      row.bookingId,
    )
    if (saved.paymentId !== row.paymentId || saved.status !== 'Confirmed' || saved.currency !== row.currency || saved.confirmedAmount !== row.requestedAmount) {
      throw new Error('Chưa xác nhận được kết quả khoản thu. Tải lại lịch sử để đối chiếu.')
    }
    return saved
  },
}

export const sepayReconciliationApi = {
  list: async (
    params: {
      status?: SepayTransactionStatus | ''
      reconciliationStatus?: SepayReconciliationStatus | ''
      bookingId?: string
      search?: string
      page?: number
      size?: number
    },
    signal?: AbortSignal,
  ): Promise<SepayReconciliationPage> => {
    const raw = await apiRequest<Record<string, unknown>>('/payment/sepay/reconciliation', {
      query: {
        status: params.status || undefined,
        reconciliationStatus: params.reconciliationStatus || undefined,
        bookingId: params.bookingId || undefined,
        search: params.search?.trim() || undefined,
        page: params.page ?? 0,
        size: params.size ?? 20,
      },
      signal,
    })
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.content)) {
      throw new Error('Không đọc được danh sách đối soát SePay.')
    }
    return {
      content: raw.content.map(decodeSepayTransaction),
      page: Number(raw.page ?? 0),
      size: Number(raw.size ?? 20),
      totalElements: Number(raw.totalElements ?? 0),
      totalPages: Number(raw.totalPages ?? 0),
      pendingReviewCount: Number(raw.pendingReviewCount ?? 0),
      retryRequiredCount: Number(raw.retryRequiredCount ?? 0),
    }
  },
  detail: async (transactionId: string, signal?: AbortSignal): Promise<SepayTransaction> => {
    const raw = await apiRequest<unknown>(`/payment/sepay/reconciliation/${encodeURIComponent(transactionId)}`, { signal })
    return decodeSepayTransaction(raw)
  },
  resolve: async (
    transactionId: string,
    body: {
      action: SepayReconciliationAction
      reason: string
      evidenceReference: string
      targetBookingId?: string
    },
  ): Promise<SepayTransaction> => {
    const raw = await apiRequest<unknown>(`/payment/sepay/reconciliation/${encodeURIComponent(transactionId)}/resolve`, {
      method: 'POST',
      body: {
        action: body.action,
        reason: body.reason.trim(),
        evidenceReference: body.evidenceReference.trim(),
        targetBookingId: body.targetBookingId?.trim() || undefined,
      },
    })
    return decodeSepayTransaction(raw)
  },
  retry: async (transactionId: string): Promise<SepayTransaction> => {
    const raw = await apiRequest<unknown>(`/payment/sepay/reconciliation/${encodeURIComponent(transactionId)}/retry`, {
      method: 'POST',
    })
    return decodeSepayTransaction(raw)
  },
}
