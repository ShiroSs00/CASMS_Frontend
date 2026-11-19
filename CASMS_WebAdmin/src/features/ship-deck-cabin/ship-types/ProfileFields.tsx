import { useId } from 'react'
import { Field } from '@/shared/ui'
import { profileGroups, type ProfileDraft, type ProfileErrors, type ProfileKey } from './profile'
import type { OperationalProfile } from './api'
import styles from './ShipWork.module.css'

const groupDescriptions: Record<string, string> = {
  'Bàn giao': 'Ghi nhận thời điểm nhận bàn giao tàu.',
  'Đăng ký và đăng kiểm': 'Thông tin định danh và cơ quan đăng kiểm của tàu.',
  'Tham chiếu hồ sơ': 'Chứng nhận, bảo hành và bảo trì. Nhập mỗi tham chiếu trên một dòng.',
}

export function ProfileFields({ draft, errors, disabled, onChange, onBlur, grouped = false }: {
  draft: ProfileDraft; errors: ProfileErrors; disabled?: boolean
  grouped?: boolean
  onChange: (key: ProfileKey, value: string) => void
  onBlur: (key: ProfileKey) => void
}) {
  const prefix = useId()
  return <>{profileGroups.map((group, groupIndex) => <section className={`${styles.formSection} ${grouped ? styles.profileFormGroup : ''}`} key={group.title}
    data-reference-group={group.fields.every(field => 'kind' in field && field.kind === 'references')}>
    {grouped ? <div className={styles.profileGroupHeading}><h4>{group.title}</h4><p id={`${prefix}-group-${groupIndex}`}>{groupDescriptions[group.title]}</p></div> : <h3>{group.title}</h3>}
    <div className={styles.grid}>
      {group.fields.map(field => {
        const id = prefix + '-' + field.key
        const kind = 'kind' in field ? field.kind : 'text'
        const props = {
          id, value: draft[field.key] ?? '', disabled,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field.key, event.target.value),
          onBlur: () => onBlur(field.key),
          'aria-describedby': grouped ? `${prefix}-group-${groupIndex}` : undefined,
        }
        return <Field key={field.key} htmlFor={id} label={field.label} error={errors[field.key]}
          hint={kind === 'references' ? grouped ? undefined : 'Mỗi tham chiếu trên một dòng.' : 'hint' in field ? field.hint : undefined}>
          {kind === 'references' ? <textarea {...props} rows={grouped ? 2 : 3} />
            : <input {...props} type={kind} maxLength={'max' in field ? field.max : undefined} />}
        </Field>
      })}
    </div>
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
        const dateValue = 'kind' in field && field.kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? value.split('-').reverse().join('/') : value
        return <div key={field.key}><dt>{field.label}</dt><dd className={styles.reference}>
          {Array.isArray(value) && value.length > 0 ? <ul>{value.map((item, index) => <li key={item + ':' + index}>{item}</li>)}</ul>
            : !Array.isArray(value) && value ? dateValue : <span className={styles.missingValue}>Chưa cung cấp</span>}
        </dd></div>
      })}
    </dl>
  </section>)}</div>
}
