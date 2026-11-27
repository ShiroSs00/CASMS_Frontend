import { useId, useState } from 'react'
import { Field, Notice } from '@/shared/ui'
import {
  CLASSIFICATION_SOCIETIES,
  OTHER_CLASSIFICATION_VALUE,
  SUPPORTED_FLAG_COUNTRY_CODES,
  isClassificationExpired,
  profileGroups,
  type ProfileDraft,
  type ProfileErrors,
  type ProfileKey,
} from './profile'
import type { OperationalProfile } from './api'
import styles from './ShipWork.module.css'

const regionDisplayNames = new Intl.DisplayNames(['vi'], { type: 'region' })
const registrationCountries = [...new Set(SUPPORTED_FLAG_COUNTRY_CODES)]
  .map(code => ({ code, name: regionDisplayNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

const fieldPlaceholders: Partial<Record<ProfileKey, string>> = {
  imoNumber: 'Ví dụ: 9074729',
  registrationNumber: 'Ví dụ: BS-2025-00128',
  certificateReferences: 'Passenger Ship Safety Certificate\nSafety Management Certificate',
  warrantyReferences: 'Main Engine Warranty\nHVAC System Warranty',
  maintenanceReferences: 'Main Engine Maintenance - 2026\nFire Safety System Inspection',
}

function formatCountryCode(code: string) {
  const upper = code.trim().toUpperCase()
  if (!upper) return ''
  try {
    const label = regionDisplayNames.of(upper)
    return label && label !== upper ? `${label} (${upper})` : upper
  } catch {
    return upper
  }
}

const groupDescriptions: Record<string, string> = {
  'Bàn giao': 'Ghi nhận thời điểm nhận bàn giao tàu.',
  'Đăng ký và đăng kiểm': 'Thông tin định danh, quốc kỳ và cơ quan đăng kiểm của tàu.',
  'Tham chiếu hồ sơ': 'Chứng nhận, bảo hành và bảo trì. Nhập mỗi tham chiếu trên một dòng, không trùng lặp (tối đa 255 ký tự/dòng).',
}

function isPresetSociety(value: string) {
  return (CLASSIFICATION_SOCIETIES as readonly string[]).includes(value)
}

export function ProfileFields({ draft, errors, disabled, onChange, onBlur, grouped = false }: {
  draft: ProfileDraft; errors: ProfileErrors; disabled?: boolean
  grouped?: boolean
  onChange: (key: ProfileKey, value: string) => void
  onBlur: (key: ProfileKey) => void
}) {
  const prefix = useId()
  const initialSociety = (draft.classificationSociety ?? '').trim()
  const [customSocietyMode, setCustomSocietyMode] = useState(
    () => Boolean(initialSociety && !isPresetSociety(initialSociety)),
  )
  const expiryExpired = isClassificationExpired(draft.classificationExpiryDate)

  return <>{profileGroups.map((group, groupIndex) => <section className={`${styles.formSection} ${grouped ? styles.profileFormGroup : ''}`} key={group.title}
    data-reference-group={group.fields.every(field => 'kind' in field && field.kind === 'references')}>
    {grouped ? <div className={styles.profileGroupHeading}><h4>{group.title}</h4><p id={`${prefix}-group-${groupIndex}`}>{groupDescriptions[group.title]}</p></div> : <h3>{group.title}</h3>}
    <div className={styles.grid}>
      {group.fields.map(field => {
        const id = prefix + '-' + field.key
        const kind = 'kind' in field ? field.kind : 'text'
        const currentValue = draft[field.key] ?? ''
        const props = {
          id, value: currentValue, disabled,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(field.key, event.target.value),
          onBlur: () => onBlur(field.key),
          'aria-describedby': grouped ? `${prefix}-group-${groupIndex}` : undefined,
        }

        if (field.key === 'classificationSociety') {
          const selectVal = customSocietyMode
            ? OTHER_CLASSIFICATION_VALUE
            : isPresetSociety(currentValue) ? currentValue : ''
          return <Field key={field.key} htmlFor={id} label={field.label} error={errors[field.key]} hint={field.hint}>
            <>
              <select
                id={id}
                value={selectVal}
                disabled={disabled}
                aria-describedby={grouped ? `${prefix}-group-${groupIndex}` : undefined}
                onChange={event => {
                  const chosen = event.target.value
                  if (chosen === OTHER_CLASSIFICATION_VALUE) {
                    setCustomSocietyMode(true)
                    onChange('classificationSociety', OTHER_CLASSIFICATION_VALUE)
                  } else {
                    setCustomSocietyMode(false)
                    onChange('classificationSociety', chosen)
                  }
                }}
                onBlur={() => onBlur('classificationSociety')}
              >
                <option value="">Chọn tổ chức đăng kiểm</option>
                {CLASSIFICATION_SOCIETIES.map(society => (
                  <option key={society} value={society}>{society}</option>
                ))}
                <option value={OTHER_CLASSIFICATION_VALUE}>Khác (nhập tên tổ chức)</option>
              </select>
              {customSocietyMode && (
                <input
                  id={`${id}-custom`}
                  type="text"
                  maxLength={150}
                  disabled={disabled}
                  placeholder="Nhập tên tổ chức đăng kiểm (2–150 ký tự)"
                  value={currentValue === OTHER_CLASSIFICATION_VALUE ? '' : currentValue}
                  onChange={event => onChange('classificationSociety', event.target.value || OTHER_CLASSIFICATION_VALUE)}
                  onBlur={() => onBlur('classificationSociety')}
                  style={{ marginTop: '8px' }}
                />
              )}
            </>
          </Field>
        }

        return <Field key={field.key} htmlFor={id} label={field.label} error={errors[field.key]}
          hint={kind === 'references' ? grouped ? undefined : 'Mỗi tham chiếu trên một dòng, không trùng lặp (tối đa 255 ký tự).' : 'hint' in field ? field.hint : undefined}>
          {field.key === 'registrationCountry' ? (
            <select {...props}>
              <option value="">Chọn quốc gia đăng ký</option>
              {currentValue && !registrationCountries.some(c => c.code === currentValue.toUpperCase()) && (
                <option value={currentValue.toUpperCase()}>{formatCountryCode(currentValue)}</option>
              )}
              {registrationCountries.map(country => (
                <option key={country.code} value={country.code}>{country.name} ({country.code})</option>
              ))}
            </select>
          ) : kind === 'references' ? (
            <textarea {...props} rows={grouped ? 2 : 3} placeholder={fieldPlaceholders[field.key]} />
          ) : (
            <input
              {...props}
              type={kind}
              inputMode={field.key === 'imoNumber' ? 'numeric' : undefined}
              maxLength={'max' in field ? field.max : undefined}
              placeholder={fieldPlaceholders[field.key]}
            />
          )}
        </Field>
      })}
    </div>
    {group.title === 'Đăng ký và đăng kiểm' && expiryExpired && (
      <div style={{ marginTop: '12px' }}>
        <Notice title="Đăng kiểm đã hết hạn" tone="warning">
          Ngày hết hạn đăng kiểm nhỏ hơn ngày hiện tại. Tàu sẽ không đủ điều kiện đưa vào khai thác hoặc gán chuyến đi cho đến khi gia hạn hồ sơ đăng kiểm.
        </Notice>
      </div>
    )}
  </section>)}</>
}

export function ProfileFacts({ profile, onlyProvided = false, className = '' }: { profile: OperationalProfile; onlyProvided?: boolean; className?: string }) {
  const groups = profileGroups.map(group => ({ ...group, fields: group.fields.filter(({ key }) => {
    const value = profile[key]
    return !onlyProvided || (Array.isArray(value) ? value.length > 0 : Boolean(value))
  }) })).filter(group => group.fields.length > 0)
  return <div className={`${styles.stack} ${className}`.trim()}>{groups.map(group => <section className={styles.formSection} key={group.title}>
    <h3>{group.title}</h3><dl className={styles.facts}>
      {group.fields.map(field => {
        const value = profile[field.key]
        const displayValue = field.key === 'registrationCountry' && typeof value === 'string'
          ? formatCountryCode(value)
          : 'kind' in field && field.kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? value.split('-').reverse().join('/') : value
        return <div key={field.key}><dt>{field.label}</dt><dd className={styles.reference}>
          {Array.isArray(value) && value.length > 0 ? <ul>{value.map((item, index) => <li key={item + ':' + index}>{item}</li>)}</ul>
            : !Array.isArray(value) && value ? displayValue : <span className={styles.missingValue}>Chưa cung cấp</span>}
        </dd></div>
      })}
    </dl>
  </section>)}</div>
}
