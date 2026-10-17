export type SupplierStatus = 'ACTIVE' | 'INACTIVE'
export type SupplierVerification = 'PENDING' | 'VERIFIED' | 'REJECTED'

export type SupplierListItem = {
  id: string
  supplierName: string
  supplierType: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  status: SupplierStatus
  verificationStatus: SupplierVerification
  updatedAt: string
  notes?: string | null
  createdAt?: string | null
  verifiedAt?: string | null
  verifiedBy?: string | null
  verificationNotes?: string | null
}

export type SupplierFilters = {
  search: string
  status: 'ALL' | SupplierStatus
  verification: 'ALL' | SupplierVerification
}

export const emptySupplierFilters: SupplierFilters = { search: '', status: 'ALL', verification: 'ALL' }

export const supplierStatusLabels: Record<SupplierStatus, string> = {
  ACTIVE: 'Đang dùng', INACTIVE: 'Tạm dừng',
}
export const supplierVerificationLabels: Record<SupplierVerification, string> = {
  PENDING: 'Chờ xác minh', VERIFIED: 'Đã xác minh', REJECTED: 'Bị từ chối',
}

// UI-SUP-001 & UI-SUP-003 fixtures stay local to the feature; no Supplier HTTP adapter.
export const supplierRows: readonly SupplierListItem[] = [
  {
    id: 'sup-001',
    supplierName: 'Mediterranean Coast Experiences',
    supplierType: 'Local Tour Operator',
    contactName: 'Elena Rossi',
    contactEmail: 'elena.rossi@example.com',
    contactPhone: '+34 600 123 456',
    status: 'ACTIVE',
    verificationStatus: 'PENDING',
    notes: 'Đối tác điều phối tour bờ và hỗ trợ vận hành tại cảng.',
    createdAt: '2026-10-12T14:20:00',
    updatedAt: '2026-10-17T09:40:00',
    verifiedAt: null,
    verifiedBy: null,
    verificationNotes: null,
  },
  {
    id: 'sup-002',
    supplierName: 'Bay Tender Services',
    supplierType: 'Tender / Transfer',
    contactName: 'Nina Cole',
    contactEmail: null,
    contactPhone: '+34 600 123 456',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    notes: 'Đội xuồng trung chuyển chuyên dụng giữa tàu và bến cảng.',
    createdAt: '2026-09-01T10:00:00',
    updatedAt: '2026-10-16T15:30:00',
    verifiedAt: '2026-09-05T09:15:00',
    verifiedBy: 'Người dùng hệ thống',
    verificationNotes: 'Đầy đủ chứng chỉ an toàn hàng hải.',
  },
  {
    id: 'sup-003',
    supplierName: 'Heritage Dining Partner',
    supplierType: 'Dining',
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    status: 'INACTIVE',
    verificationStatus: 'REJECTED',
    notes: null,
    createdAt: '2026-08-15T08:00:00',
    updatedAt: '2026-10-14T11:20:00',
    verifiedAt: '2026-08-20T16:00:00',
    verifiedBy: 'Người dùng hệ thống',
    verificationNotes: 'Không cung cấp đủ giấy phép vệ sinh an toàn thực phẩm.',
  },
]

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function filterSuppliers(rows: readonly SupplierListItem[], filters: SupplierFilters) {
  const search = normalizeSearch(filters.search)
  return rows.filter(row => (filters.status === 'ALL' || row.status === filters.status)
    && (filters.verification === 'ALL' || row.verificationStatus === filters.verification)
    && (!search || [row.supplierName, row.supplierType, row.contactName, row.contactEmail, row.contactPhone]
      .some(value => value !== null && normalizeSearch(value).includes(search))))
}

export function supplierContact(row: SupplierListItem) {
  return [row.contactName, row.contactEmail || row.contactPhone].filter(Boolean).join(' · ') || 'Chưa có email'
}

export function supplierUpdatedDate(value: string) {
  const datePart = value.includes('T') ? value.split('T')[0] : value
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}`
}

export function supplierDateTime(value?: string | null): string {
  if (!value) return '—'
  if (value.includes('T')) {
    const [datePart, timePart] = value.split('T')
    const [year, month, day] = datePart.split('-')
    const time = timePart.slice(0, 5)
    return `${day}/${month}/${year} · ${time}`
  }
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
