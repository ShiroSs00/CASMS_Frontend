import type { EditableProfile, OperationalProfile } from './api'

export const SUPPORTED_FLAG_COUNTRY_CODES = [
  'VN', 'SG', 'PA', 'BS', 'MT', 'MH', 'LR', 'BM', 'CY', 'NO', 'IT', 'FR', 'GB', 'US',
  'JP', 'KR', 'TH', 'MY', 'ID', 'PH', 'CN', 'HK', 'TW', 'AU', 'NZ', 'GR', 'NL', 'DE',
] as const

export const CLASSIFICATION_SOCIETIES = [
  "Lloyd's Register",
  'DNV',
  'Bureau Veritas',
  'ABS',
  'ClassNK',
  'RINA',
  'CCS',
  'Vietnam Register (VR)',
] as const

export const OTHER_CLASSIFICATION_VALUE = '__OTHER__'

export const profileGroups = [
  { title: 'Bàn giao', fields: [
    { key: 'deliveryDate', label: 'Ngày bàn giao', kind: 'date' },
  ] },
  { title: 'Đăng ký và đăng kiểm', fields: [
    { key: 'imoNumber', label: 'Số IMO', max: 7, hint: 'Nhập chính xác 7 chữ số (0–9) hợp lệ theo checksum IMO, ví dụ: 9074729.' },
    { key: 'registrationCountry', label: 'Quốc gia đăng ký', max: 2, hint: 'Chọn quốc gia đăng ký tàu (quốc kỳ, chuẩn ISO 3166-1 alpha-2).' },
    { key: 'registrationNumber', label: 'Số đăng ký', max: 50, hint: 'Tối đa 50 ký tự, cho phép chữ, số và dấu phân cách (ví dụ: BS-2025-00128).' },
    { key: 'classificationSociety', label: 'Tổ chức đăng kiểm', max: 150, hint: 'Chọn tổ chức đăng kiểm từ danh mục hoặc chọn Khác để nhập tên (2–150 ký tự).' },
    { key: 'classificationDate', label: 'Ngày đăng kiểm', kind: 'date', hint: 'Ngày thực hiện đăng kiểm gần nhất (không ở tương lai).' },
    { key: 'classificationExpiryDate', label: 'Ngày hết hạn đăng kiểm', kind: 'date', hint: 'Phải sau ngày đăng kiểm và còn hiệu lực đến hết thời gian chuyến đi (ExpiryDate ≥ CruiseEndDate).' },
  ] },
  { title: 'Tham chiếu hồ sơ', fields: [
    { key: 'certificateReferences', label: 'Chứng nhận', kind: 'references' },
    { key: 'warrantyReferences', label: 'Bảo hành', kind: 'references' },
    { key: 'maintenanceReferences', label: 'Bảo trì và sửa chữa', kind: 'references' },
  ] },
] as const

export type ProfileField = typeof profileGroups[number]['fields'][number]
export type ProfileKey = keyof EditableProfile
export type ProfileDraft = Partial<Record<ProfileKey, string>>
export type ProfileErrors = Partial<Record<ProfileKey, string>>

export function toProfileDraft(profile?: OperationalProfile | null): ProfileDraft {
  return Object.fromEntries(profileGroups.flatMap(group => group.fields.map(({ key }) => {
    const value = profile?.[key]
    return [key, Array.isArray(value) ? value.join('\n') : String(value ?? '')]
  })))
}

const rows = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
const localDate = () => new Date().toLocaleDateString('sv-SE')

export function isValidImoChecksum(value: string): boolean {
  if (!/^[0-9]{7}$/.test(value)) return false
  let sum = 0
  for (let i = 0; i < 6; i++) {
    sum += Number(value[i]) * (7 - i)
  }
  return sum % 10 === Number(value[6])
}

export function isClassificationExpired(expiryDate?: string): boolean {
  const value = expiryDate?.trim()
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value < localDate())
}

const requiredFieldMessages: Record<ProfileKey, string> = {
  deliveryDate: 'Vui lòng nhập ngày bàn giao.',
  imoNumber: 'Vui lòng nhập số IMO (7 chữ số hợp lệ).',
  registrationCountry: 'Vui lòng chọn quốc gia đăng ký.',
  registrationNumber: 'Vui lòng nhập số đăng ký tàu.',
  classificationSociety: 'Vui lòng chọn hoặc nhập tổ chức đăng kiểm.',
  classificationDate: 'Vui lòng nhập ngày đăng kiểm.',
  classificationExpiryDate: 'Vui lòng nhập ngày hết hạn đăng kiểm.',
  certificateReferences: 'Vui lòng nhập ít nhất một tham chiếu chứng nhận.',
  warrantyReferences: 'Vui lòng nhập ít nhất một tham chiếu bảo hành.',
  maintenanceReferences: 'Vui lòng nhập ít nhất một tham chiếu bảo trì và sửa chữa.',
}

export function validateProfile(draft: ProfileDraft, options?: { requireAll?: boolean }): ProfileErrors {
  const requireAll = Boolean(options?.requireAll)
  const errors: ProfileErrors = {}
  for (const { fields } of profileGroups) for (const field of fields) {
    const raw = draft[field.key] ?? ''
    const value = raw.trim()
    if (!value) {
      if (raw.length > 0 && (field.key === 'registrationNumber' || field.key === 'classificationSociety')) {
        errors[field.key] = 'Không được chỉ nhập khoảng trắng.'
      } else if (requireAll) {
        errors[field.key] = requiredFieldMessages[field.key]
      }
      continue
    }
    if ('max' in field && value.length > field.max) errors[field.key] = 'Dùng tối đa ' + field.max + ' ký tự.'
    if ('kind' in field && field.kind === 'references') {
      const rawLines = raw.split(/\r?\n/)
      if (rawLines.some(line => line.length > 0 && line.trim().length === 0)) {
        errors[field.key] = 'Không được để dòng chỉ chứa khoảng trắng.'
        continue
      }
      const references = rows(value)
      if (references.length > 100 || references.some(item => item.length > 255)) {
        errors[field.key] = 'Tối đa 100 dòng, mỗi dòng không quá 255 ký tự.'
        continue
      }
      const seen = new Set<string>()
      for (const item of references) {
        const norm = item.toLowerCase()
        if (seen.has(norm)) {
          errors[field.key] = 'Không được nhập trùng tham chiếu trên cùng một danh sách.'
          break
        }
        seen.add(norm)
      }
    }
  }

  const imo = draft.imoNumber?.trim()
  if (imo) {
    if (!/^[0-9]{7}$/.test(imo)) {
      errors.imoNumber = 'Số IMO phải gồm chính xác 7 chữ số (0–9), không kèm chữ cái hoặc khoảng trắng.'
    } else if (!isValidImoChecksum(imo)) {
      errors.imoNumber = 'Số IMO sai chữ số kiểm tra (checksum IMO không hợp lệ). Ví dụ hợp lệ: 9074729.'
    }
  }

  const country = draft.registrationCountry?.trim().toUpperCase()
  if (country && !(SUPPORTED_FLAG_COUNTRY_CODES as readonly string[]).includes(country)) {
    errors.registrationCountry = 'Quốc gia đăng ký không nằm trong danh sách quốc kỳ được hỗ trợ.'
  }
  const regNum = draft.registrationNumber?.trim()
  if (country && !regNum) errors.registrationNumber = 'Vui lòng nhập số đăng ký tương ứng với quốc gia đăng ký.'
  if (!country && regNum) errors.registrationCountry = 'Vui lòng chọn quốc gia đăng ký cùng với số đăng ký.'
  if (regNum && !/^[A-Za-z0-9][A-Za-z0-9 ./_-]{0,49}$/.test(regNum)) {
    errors.registrationNumber = 'Số đăng ký chỉ cho phép chữ, số và dấu phân cách (1–50 ký tự).'
  }

  const society = draft.classificationSociety?.trim()
  if (society === OTHER_CLASSIFICATION_VALUE) {
    errors.classificationSociety = 'Vui lòng nhập tên tổ chức đăng kiểm (2–150 ký tự).'
  } else if (society && society.length < 2) {
    errors.classificationSociety = 'Tên tổ chức đăng kiểm phải từ 2 đến 150 ký tự.'
  }

  const delivery = draft.deliveryDate?.trim()
  const classificationDate = draft.classificationDate?.trim()
  const expiry = draft.classificationExpiryDate?.trim()
  if (delivery && delivery > localDate()) {
    errors.deliveryDate = 'Ngày bàn giao không được ở tương lai.'
  }
  if (classificationDate && classificationDate > localDate()) {
    errors.classificationDate = 'Ngày đăng kiểm không được ở tương lai.'
  }
  if (delivery && expiry && expiry < delivery) {
    errors.classificationExpiryDate = 'Ngày hết hạn đăng kiểm không được trước ngày bàn giao.'
  }
  if (classificationDate && expiry && expiry <= classificationDate) {
    errors.classificationExpiryDate = 'Ngày hết hạn đăng kiểm phải sau ngày đăng kiểm.'
  }

  return errors
}

export function profilePayload(draft: ProfileDraft): EditableProfile {
  const entries = profileGroups.flatMap(group => group.fields.flatMap<[ProfileKey, string | string[]]>(({ key }) => {
    const value = draft[key]?.trim()
    if (!value || (key === 'classificationSociety' && value === OTHER_CLASSIFICATION_VALUE)) return []
    if (key.endsWith('References')) return [[key, rows(value)]]
    if (key.endsWith('Country') || key === 'registrationNumber') return [[key, value.toUpperCase()]]
    return [[key, value]]
  }))
  return Object.fromEntries(entries)
}

export function missingProfileLabels(details: unknown): string[] {
  const groups = (details as { missingGroups?: unknown } | undefined)?.missingGroups
  const labels: Record<string, string> = {
    certification: 'Đăng kiểm và hồ sơ chứng nhận',
    warranty: 'Hồ sơ bảo hành',
    maintenance: 'Hồ sơ bảo trì và sửa chữa',
  }
  return Array.isArray(groups) ? groups.flatMap(key => typeof key === 'string' && labels[key] ? [labels[key]] : []) : []
}
