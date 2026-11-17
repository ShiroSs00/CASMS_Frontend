import type { EditableProfile, OperationalProfile } from './api'

export const profileGroups = [
  { title: 'Bàn giao', fields: [
    { key: 'deliveryDate', label: 'Ngày bàn giao', kind: 'date' },
  ] },
  { title: 'Đăng ký và đăng kiểm', fields: [
    { key: 'imoNumber', label: 'Số IMO', max: 11, hint: 'Nhập 7 chữ số nếu có.' },
    { key: 'registrationCountry', label: 'Quốc gia đăng ký', max: 2, hint: 'Mã quốc gia gồm hai chữ cái, ví dụ VN.' },
    { key: 'registrationNumber', label: 'Số đăng ký', max: 80 },
    { key: 'classificationSociety', label: 'Tổ chức đăng kiểm', max: 150 },
    { key: 'classificationExpiryDate', label: 'Ngày hết hạn đăng kiểm', kind: 'date' },
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

export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {}
  for (const { fields } of profileGroups) for (const field of fields) {
    const value = draft[field.key]?.trim()
    if (!value) continue
    if ('max' in field && value.length > field.max) errors[field.key] = 'Dùng tối đa ' + field.max + ' ký tự.'
    if ('kind' in field && field.kind === 'references') {
      const references = rows(value)
      if (references.length > 100 || references.some(item => item.length > 1000)) {
        errors[field.key] = 'Tối đa 100 dòng, mỗi dòng không quá 1.000 ký tự.'
      }
    }
  }
  const country = draft.registrationCountry?.trim()
  if (country && !/^[a-z]{2}$/i.test(country)) errors.registrationCountry = 'Nhập mã quốc gia gồm hai chữ cái.'
  if (draft.registrationCountry?.trim() && !draft.registrationNumber?.trim()) errors.registrationNumber = 'Nhập số đăng ký cùng quốc gia đăng ký.'
  if (!draft.registrationCountry?.trim() && draft.registrationNumber?.trim()) errors.registrationCountry = 'Nhập quốc gia đăng ký cùng số đăng ký.'
  if (draft.imoNumber?.trim() && !/^(?:IMO )?[0-9]{7}$/i.test(draft.imoNumber.trim())) errors.imoNumber = 'Số IMO gồm 7 chữ số.'
  if (draft.deliveryDate && draft.deliveryDate > localDate()) errors.deliveryDate = 'Ngày bàn giao không thể ở tương lai.'
  return errors
}

export function profilePayload(draft: ProfileDraft): EditableProfile {
  const entries = profileGroups.flatMap(group => group.fields.flatMap<[ProfileKey, string | string[]]>(({ key }) => {
    const value = draft[key]?.trim()
    if (!value) return []
    if (key.endsWith('References')) return [[key, rows(value)]]
    if (key.endsWith('Country') || key === 'registrationNumber') return [[key, value.toUpperCase()]]
    if (key === 'imoNumber') return [[key, value.replace(/^IMO /i, '')]]
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
