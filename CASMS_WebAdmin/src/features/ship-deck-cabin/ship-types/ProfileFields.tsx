import { useId } from 'react'
import { Field } from '@/shared/ui'
import { profileGroups, type ProfileDraft, type ProfileErrors, type ProfileKey } from './profile'
import type { OperationalProfile } from './api'
import styles from './ShipWork.module.css'

export function ProfileFields({ draft, errors, disabled, onChange, onBlur }: {
  draft: ProfileDraft; errors: ProfileErrors; disabled?: boolean
  onChange: (key: ProfileKey, value: string) => void
  onBlur: (key: ProfileKey) => void
}) {
  const prefix = useId()
  return <>{profileGroups.map(group => <section className={styles.formSection} key={group.title}>
    <h3>{group.title}</h3><div className={styles.grid}>
      {group.fields.map(field => {
        const id = prefix + '-' + field.key
        const kind = 'kind' in field ? field.kind : 'text'
        const props = {
          id, value: draft[field.key] ?? '', disabled,
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field.key, event.target.value),
          onBlur: () => onBlur(field.key),
        }
        return <Field key={field.key} htmlFor={id} label={field.label} error={errors[field.key]}
          hint={kind === 'references' ? 'Mỗi tham chiếu trên một dòng.' : 'hint' in field ? field.hint : undefined}>
          {kind === 'references' ? <textarea {...props} rows={3} />
            : <input {...props} type={kind} maxLength={'max' in field ? field.max : undefined} />}
        </Field>
      })}
    </div>
  </section>)}</>
}

export function ProfileFacts({ profile, onlyProvided = false }: { profile: OperationalProfile; onlyProvided?: boolean }) {
  const groups = profileGroups.map(group => ({ ...group, fields: group.fields.filter(({ key }) => {
    const value = profile[key]
    return !onlyProvided || (Array.isArray(value) ? value.length > 0 : Boolean(value))
  }) })).filter(group => group.fields.length > 0)
  return <div className={styles.stack}>{groups.map(group => <section className={styles.formSection} key={group.title}>
    <h3>{group.title}</h3><dl className={styles.facts}>
      {group.fields.map(field => {
        const value = profile[field.key]
        return <div key={field.key}><dt>{field.label}</dt><dd className={styles.reference}>
          {Array.isArray(value) && value.length > 0 ? <ul>{value.map((item, index) => <li key={item + ':' + index}>{item}</li>)}</ul>
            : !Array.isArray(value) && value ? value : 'Chưa cung cấp'}
        </dd></div>
      })}
    </dl>
  </section>)}</div>
}
