import { apiRequest } from '@/shared/api'

export type CheckoutPaymentType = 'FULL' | 'DEPOSIT' | 'STAGE'
export type SepayOrderStatus =
  | 'Initiated'
  | 'Pending'
  | 'Authorized'
  | 'Captured'
  | 'Confirmed'
  | 'Failed'
  | 'Cancelled'
  | 'PartiallyRefunded'
  | 'Refunded'

export type RecommendedPaymentOption = {
  paymentType: CheckoutPaymentType
  installmentId: string | null
  sequenceNo: number | null
  label: string
  description: string | null
  amount: number
  amountVnd: number
  currency: string
  dueAt: string | null
}

export type SepayStageOption = {
  installmentId: string
  sequenceNo: number
  installmentType: string
  requiredAmountVnd: number
  paidAmountVnd: number
  remainingAmountVnd: number
  dueAt: string | null
  status: string
  paid: boolean
  currentDue: boolean
  description: string | null
}

export type SepayCheckoutOrder = {
  paymentId: string
  bookingId: string
  bookingReference: string
  paymentType: CheckoutPaymentType
  installmentId: string | null
  sequenceNo: number | null
  stageDescription: string | null
  amountVnd: number
  paymentCurrency: string
  chargedAmount: number
  paymentChannel: string
  bankName: string
  accountNumber: string
  accountHolderName: string
  transferContent: string
  qrCodeUrl: string
  status: SepayOrderStatus
  createdAt: string | null
  idempotencyKey: string | null
  installmentDueAt: string | null
  bookingHoldExpiresAt: string | null
  expiresAt: string | null
  stale: boolean
  bookingStatus: string | null
  contractStatus: string | null
  instructions: string | null
}

export type BookingPaymentOptions = {
  bookingId: string
  bookingReference: string
  bookingStatus: string
  contractStatus: string | null
  holdExpiresAt: string | null
  currency: string
  agreedFareAmountVnd: number
  totalPaidAmountVnd: number
  outstandingBalance: number
  outstandingBalanceVnd: number
  fullyPaid: boolean
  vietQrEligible: boolean
  ineligibleCode: string | null
  ineligibleReason: string | null
  configuredPaymentPlan: 'FULL' | 'DEPOSIT' | 'STAGES' | null
  recommendedOption: RecommendedPaymentOption | null
  activePendingOrder: SepayCheckoutOrder | null
  fullPaymentOption: {
    available: boolean
    amountVnd: number
    dueAt: string | null
    description: string | null
  } | null
  depositPaymentOption: {
    available: boolean
    paid: boolean
    installmentId: string | null
    sequenceNo: number | null
    requiredAmountVnd: number
    paidAmountVnd: number
    remainingAmountVnd: number
    dueAt: string | null
    description: string | null
  } | null
  stagePaymentOption: {
    available: boolean
    totalStages: number
    stages: SepayStageOption[]
  } | null
}

export type SepayPaymentStatus = {
  paymentId: string
  bookingId: string | null
  bookingReference: string | null
  status: SepayOrderStatus
  requestedAmount: number
  confirmedAmount: number | null
  currency: string
  requestedAt: string | null
  confirmedAt: string | null
  processorReference: string | null
  bookingStatus: string | null
  bookingConfirmed: boolean
  contractStatus: string | null
  totalPaidAmount: number | null
  remainingBookingBalance: number | null
  fullyPaid: boolean
  transferContent: string | null
  paymentType: CheckoutPaymentType | null
  installmentId: string | null
  sequenceNo: number | null
  failureReason: string | null
  holdExpiresAt: string | null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function decodeCheckoutOrder(value: unknown): SepayCheckoutOrder {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được thông tin lệnh VietQR.')
  const row = value as Record<string, unknown>
  if (
    typeof row.paymentId !== 'string' || !row.paymentId
    || typeof row.bookingId !== 'string' || !row.bookingId
    || typeof row.transferContent !== 'string' || !row.transferContent
    || typeof row.qrCodeUrl !== 'string' || !row.qrCodeUrl
    || typeof row.amountVnd !== 'number' || !Number.isFinite(row.amountVnd) || row.amountVnd <= 0
  ) {
    throw new Error('Thông tin lệnh VietQR từ máy chủ không đầy đủ.')
  }
  const paymentType = (['FULL', 'DEPOSIT', 'STAGE'].includes(String(row.paymentType))
    ? row.paymentType
    : 'FULL') as CheckoutPaymentType
  return {
    paymentId: row.paymentId,
    bookingId: row.bookingId,
    bookingReference: typeof row.bookingReference === 'string' ? row.bookingReference : '',
    paymentType,
    installmentId: asNullableString(row.installmentId),
    sequenceNo: asNullableNumber(row.sequenceNo),
    stageDescription: asNullableString(row.stageDescription),
    amountVnd: row.amountVnd,
    paymentCurrency: typeof row.paymentCurrency === 'string' ? row.paymentCurrency : 'VND',
    chargedAmount: asNumber(row.chargedAmount, row.amountVnd),
    paymentChannel: typeof row.paymentChannel === 'string' ? row.paymentChannel : 'VIETQR',
    bankName: typeof row.bankName === 'string' ? row.bankName : '',
    accountNumber: typeof row.accountNumber === 'string' ? row.accountNumber : '',
    accountHolderName: typeof row.accountHolderName === 'string' ? row.accountHolderName : '',
    transferContent: row.transferContent,
    qrCodeUrl: row.qrCodeUrl,
    status: (typeof row.status === 'string' ? row.status : 'Pending') as SepayOrderStatus,
    createdAt: asNullableString(row.createdAt),
    idempotencyKey: asNullableString(row.idempotencyKey),
    installmentDueAt: asNullableString(row.installmentDueAt),
    bookingHoldExpiresAt: asNullableString(row.bookingHoldExpiresAt),
    expiresAt: asNullableString(row.expiresAt),
    stale: asBool(row.stale, false),
    bookingStatus: asNullableString(row.bookingStatus),
    contractStatus: asNullableString(row.contractStatus),
    instructions: asNullableString(row.instructions),
  }
}

export function decodePaymentOptions(value: unknown, expectedBookingId: string): BookingPaymentOptions {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được phương án thanh toán.')
  const row = value as Record<string, unknown>
  if (row.bookingId !== expectedBookingId || typeof row.currency !== 'string') {
    throw new Error('Dữ liệu phương án thanh toán không khớp đặt chỗ hiện tại.')
  }

  const recRaw = row.recommendedOption && typeof row.recommendedOption === 'object'
    ? (row.recommendedOption as Record<string, unknown>)
    : null
  const recommendedOption: RecommendedPaymentOption | null = recRaw && typeof recRaw.amountVnd === 'number'
    ? {
        paymentType: (['FULL', 'DEPOSIT', 'STAGE'].includes(String(recRaw.paymentType))
          ? recRaw.paymentType
          : 'FULL') as CheckoutPaymentType,
        installmentId: asNullableString(recRaw.installmentId),
        sequenceNo: asNullableNumber(recRaw.sequenceNo),
        label: typeof recRaw.label === 'string' ? recRaw.label : 'Thanh toán đặt chỗ',
        description: asNullableString(recRaw.description),
        amount: asNumber(recRaw.amount, recRaw.amountVnd),
        amountVnd: recRaw.amountVnd,
        currency: typeof recRaw.currency === 'string' ? recRaw.currency : row.currency,
        dueAt: asNullableString(recRaw.dueAt),
      }
    : null

  const fullRaw = row.fullPaymentOption && typeof row.fullPaymentOption === 'object'
    ? (row.fullPaymentOption as Record<string, unknown>)
    : null
  const depositRaw = row.depositPaymentOption && typeof row.depositPaymentOption === 'object'
    ? (row.depositPaymentOption as Record<string, unknown>)
    : null
  const stageRaw = row.stagePaymentOption && typeof row.stagePaymentOption === 'object'
    ? (row.stagePaymentOption as Record<string, unknown>)
    : null

  const stages: SepayStageOption[] = Array.isArray(stageRaw?.stages)
    ? stageRaw.stages
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(item => ({
          installmentId: String(item.installmentId ?? ''),
          sequenceNo: asNumber(item.sequenceNo, 0),
          installmentType: String(item.installmentType ?? ''),
          requiredAmountVnd: asNumber(item.requiredAmountVnd),
          paidAmountVnd: asNumber(item.paidAmountVnd),
          remainingAmountVnd: asNumber(item.remainingAmountVnd),
          dueAt: asNullableString(item.dueAt),
          status: String(item.status ?? 'Scheduled'),
          paid: asBool(item.paid ?? item.isPaid, false),
          currentDue: asBool(item.currentDue ?? item.isCurrentDue, false),
          description: asNullableString(item.description),
        }))
    : []

  return {
    bookingId: row.bookingId,
    bookingReference: typeof row.bookingReference === 'string' ? row.bookingReference : '',
    bookingStatus: typeof row.bookingStatus === 'string' ? row.bookingStatus : 'Draft',
    contractStatus: asNullableString(row.contractStatus),
    holdExpiresAt: asNullableString(row.holdExpiresAt),
    currency: row.currency,
    agreedFareAmountVnd: asNumber(row.agreedFareAmountVnd),
    totalPaidAmountVnd: asNumber(row.totalPaidAmountVnd),
    outstandingBalance: asNumber(row.outstandingBalance),
    outstandingBalanceVnd: asNumber(row.outstandingBalanceVnd),
    fullyPaid: asBool(row.fullyPaid, false),
    vietQrEligible: asBool(row.vietQrEligible, false),
    ineligibleCode: asNullableString(row.ineligibleCode),
    ineligibleReason: asNullableString(row.ineligibleReason),
    configuredPaymentPlan: ['FULL', 'DEPOSIT', 'STAGES'].includes(String(row.configuredPaymentPlan))
      ? (row.configuredPaymentPlan as 'FULL' | 'DEPOSIT' | 'STAGES')
      : null,
    recommendedOption,
    activePendingOrder: row.activePendingOrder ? decodeCheckoutOrder(row.activePendingOrder) : null,
    fullPaymentOption: fullRaw
      ? {
          available: asBool(fullRaw.available ?? fullRaw.isAvailable, false),
          amountVnd: asNumber(fullRaw.amountVnd),
          dueAt: asNullableString(fullRaw.dueAt),
          description: asNullableString(fullRaw.description),
        }
      : null,
    depositPaymentOption: depositRaw
      ? {
          available: asBool(depositRaw.available ?? depositRaw.isAvailable, false),
          paid: asBool(depositRaw.paid ?? depositRaw.isPaid, false),
          installmentId: asNullableString(depositRaw.installmentId),
          sequenceNo: asNullableNumber(depositRaw.sequenceNo),
          requiredAmountVnd: asNumber(depositRaw.requiredAmountVnd),
          paidAmountVnd: asNumber(depositRaw.paidAmountVnd),
          remainingAmountVnd: asNumber(depositRaw.remainingAmountVnd),
          dueAt: asNullableString(depositRaw.dueAt),
          description: asNullableString(depositRaw.description),
        }
      : null,
    stagePaymentOption: stageRaw
      ? {
          available: asBool(stageRaw.available ?? stageRaw.isAvailable, false),
          totalStages: asNumber(stageRaw.totalStages, stages.length),
          stages,
        }
      : null,
  }
}

export function decodePaymentStatus(value: unknown): SepayPaymentStatus {
  if (!value || typeof value !== 'object') throw new Error('Không đọc được trạng thái thanh toán.')
  const row = value as Record<string, unknown>
  if (typeof row.paymentId !== 'string' || !row.paymentId || typeof row.status !== 'string') {
    throw new Error('Phản hồi trạng thái thanh toán không hợp lệ.')
  }
  return {
    paymentId: row.paymentId,
    bookingId: asNullableString(row.bookingId),
    bookingReference: asNullableString(row.bookingReference),
    status: row.status as SepayOrderStatus,
    requestedAmount: asNumber(row.requestedAmount),
    confirmedAmount: asNullableNumber(row.confirmedAmount),
    currency: typeof row.currency === 'string' ? row.currency.trim() : 'VND',
    requestedAt: asNullableString(row.requestedAt),
    confirmedAt: asNullableString(row.confirmedAt),
    processorReference: asNullableString(row.processorReference),
    bookingStatus: asNullableString(row.bookingStatus),
    bookingConfirmed: asBool(row.bookingConfirmed ?? row.isBookingConfirmed, false),
    contractStatus: asNullableString(row.contractStatus),
    totalPaidAmount: asNullableNumber(row.totalPaidAmount),
    remainingBookingBalance: asNullableNumber(row.remainingBookingBalance),
    fullyPaid: asBool(row.fullyPaid, false),
    transferContent: asNullableString(row.transferContent),
    paymentType: ['FULL', 'DEPOSIT', 'STAGE'].includes(String(row.paymentType))
      ? (row.paymentType as CheckoutPaymentType)
      : null,
    installmentId: asNullableString(row.installmentId),
    sequenceNo: asNullableNumber(row.sequenceNo),
    failureReason: asNullableString(row.failureReason),
    holdExpiresAt: asNullableString(row.holdExpiresAt),
  }
}

export type PendingAttemptIntent = {
  idempotencyKey: string
  paymentType: CheckoutPaymentType
  installmentId: string | null
  sequenceNo: number | null
  expectedAmountVnd: number
}

function attemptKey(userId: string, bookingId: string) {
  return `ocevie.vietqr.attempt.v1:${userId}:${bookingId}`
}

export const vietQrAttemptStorage = {
  read(userId: string, bookingId: string): PendingAttemptIntent | null {
    try {
      const raw = sessionStorage.getItem(attemptKey(userId, bookingId))
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<PendingAttemptIntent>
      if (typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey && parsed.paymentType) {
        return {
          idempotencyKey: parsed.idempotencyKey,
          paymentType: parsed.paymentType,
          installmentId: parsed.installmentId ?? null,
          sequenceNo: parsed.sequenceNo ?? null,
          expectedAmountVnd: typeof parsed.expectedAmountVnd === 'number' ? parsed.expectedAmountVnd : 0,
        }
      }
      return null
    } catch {
      return null
    }
  },
  write(userId: string, bookingId: string, intent: PendingAttemptIntent) {
    try {
      sessionStorage.setItem(attemptKey(userId, bookingId), JSON.stringify(intent))
    } catch {
      // Ignore storage unavailability; caller still holds the key in component ref.
    }
  },
  clear(userId: string, bookingId: string) {
    try {
      sessionStorage.removeItem(attemptKey(userId, bookingId))
    } catch {
      // Ignore
    }
  },
}

export const sepayPaymentApi = {
  async getOptions(bookingId: string, signal?: AbortSignal): Promise<BookingPaymentOptions> {
    const raw = await apiRequest<unknown>(`/payment/sepay/options/${encodeURIComponent(bookingId)}`, { signal })
    return decodePaymentOptions(raw, bookingId)
  },
  async createCheckout(request: {
    bookingId: string
    paymentType: CheckoutPaymentType
    installmentId?: string | null
    sequenceNo?: number | null
    idempotencyKey: string
    expectedOutstandingBalance?: number
    expectedAmountVnd?: number
  }): Promise<SepayCheckoutOrder> {
    const raw = await apiRequest<unknown>('/payment/sepay/checkout', {
      method: 'POST',
      body: {
        bookingId: request.bookingId,
        paymentType: request.paymentType,
        installmentId: request.installmentId || undefined,
        sequenceNo: request.sequenceNo ?? undefined,
        currency: 'VND',
        paymentChannel: 'VIETQR',
        idempotencyKey: request.idempotencyKey,
        expectedOutstandingBalance: request.expectedOutstandingBalance,
        expectedAmountVnd: request.expectedAmountVnd,
      },
    })
    return decodeCheckoutOrder(raw)
  },
  async getStatus(paymentId: string, signal?: AbortSignal): Promise<SepayPaymentStatus> {
    const raw = await apiRequest<unknown>(`/payment/sepay/status/${encodeURIComponent(paymentId)}`, { signal })
    return decodePaymentStatus(raw)
  },
}
