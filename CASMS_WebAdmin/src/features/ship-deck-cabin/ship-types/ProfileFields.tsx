import { useId } from 'react'
import { Field } from '@/shared/ui'
import { manufacturingFields, profileGroups, type ProfileDraft, type ProfileErrors, type ProfileKey } from './profile'
import type { OperationalProfile } from './api'
import styles from './ShipWork.module.css'

export function ProfileFields({ draft, errors, disabled, importedProfile, onChange, onBlur }: {
  draft: ProfileDraft; errors: ProfileErrors; disabled?: boolean; importedProfile?: OperationalProfile | null
  onChange: (key: ProfileKey, value: string) => void
  onBlur: (key: ProfileKey) => void
}) {
  const prefix = useId()
  return <>{importedProfile !== undefined && <ManufacturingFacts profile={importedProfile} />}
    {profileGroups.map(group => <section className={styles.formSection} key={group.title}>
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

export function ManufacturingFacts({ profile }: { profile: OperationalProfile | null }) {
  const historical = profile?.designMetadataImported !== true && manufacturingFields.some(({ key }) => profile?.[key] != null)
  return <section className={styles.formSection}>
    <h3>Thông tin đóng tàu</h3>
    <p>{historical ? 'Giá trị lưu từ hồ sơ cũ' : 'Lấy từ thiết kế ZIP'}</p>
    <dl className={styles.facts}>
      {manufacturingFields.map(({ key, label }) => <div key={key}>
        <dt>{label}</dt><dd>{profile?.[key] ?? 'Chưa cung cấp'}</dd>
      </div>)}
    </dl>
  </section>
}

export function ProfileFacts({ profile }: { profile: OperationalProfile }) {
  return <div className={styles.stack}>{profileGroups.map(group => <section className={styles.formSection} key={group.title}>
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
