import type { SupplierListItem } from './supplier-list'

export type SupplierFormValues = {
  supplierName: string
  supplierType: string
  contactName: string
  contactPhone: string
  contactEmail: string
  notes: string
}
export type SupplierFormField = keyof SupplierFormValues
export type SupplierFormErrors = Partial<Record<SupplierFormField, string>>
export type SupplierFormMode = 'create' | 'edit'

// Standard email-input syntax, including local domains; optional empty values remain valid.
const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export const emptySupplierForm: SupplierFormValues = {
  supplierName: '', supplierType: '', contactName: '', contactPhone: '', contactEmail: '', notes: '',
}

// Matches SupplierRequest; workflow fields deliberately stay outside the form.
export const supplierFormFields = {
  supplierName: { label: 'Tên nhà cung cấp', placeholder: 'Nhập tên nhà cung cấp', type: 'text', required: true, max: 250 },
  supplierType: { label: 'Loại nhà cung cấp', placeholder: 'Ví dụ: Local Tour Operator', type: 'text', required: false, max: 100 },
  contactName: { label: 'Tên liên hệ', placeholder: 'Nhập tên liên hệ', type: 'text', required: true, max: 200 },
  contactPhone: { label: 'Điện thoại', placeholder: 'Số điện thoại', type: 'tel', required: false, max: 50 },
  contactEmail: { label: 'Email', placeholder: 'name@example.com', type: 'email', required: false, max: 255 },
  notes: { label: 'Ghi chú', placeholder: 'Thông tin nội bộ cho đội vận hành…', required: false, max: 1000 },
} as const

export const supplierFormFieldOrder: SupplierFormField[] = [
  'supplierName', 'supplierType', 'contactName', 'contactPhone', 'contactEmail', 'notes',
]

export function supplierToForm(supplier: SupplierListItem & { notes?: string | null }): SupplierFormValues {
  return {
    supplierName: supplier.supplierName,
    supplierType: supplier.supplierType ?? '',
    contactName: supplier.contactName ?? '',
    contactPhone: supplier.contactPhone ?? '',
    contactEmail: supplier.contactEmail ?? '',
    notes: supplier.notes ?? '',
  }
}

export function validateSupplierForm(values: SupplierFormValues): SupplierFormErrors {
  const errors: SupplierFormErrors = {}
  for (const field of supplierFormFieldOrder) {
    const rule = supplierFormFields[field]
    const value = values[field]
    if (rule.required && !value.trim()) errors[field] = `Vui lòng nhập ${rule.label.toLowerCase()}.`
    else if (value.length > rule.max) errors[field] = `${rule.label} không được vượt quá ${rule.max} ký tự.`
  }
  if (!errors.contactEmail && values.contactEmail !== ''
    && !emailPattern.test(values.contactEmail)) {
    errors.contactEmail = 'Email không đúng định dạng.'
  }
  return errors
}

export function formToSupplierRequest(values: SupplierFormValues): {
  supplierName: string
  supplierType: string | null
  contactName: string
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
} {
  return {
    supplierName: values.supplierName.trim(),
    supplierType: values.supplierType.trim() || null,
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    notes: values.notes.trim() || null,
  }
}
