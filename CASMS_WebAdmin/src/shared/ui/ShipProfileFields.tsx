import { useId } from 'react'
import { productionYearLabel, shipProfileTextFields, type ShipProfile } from '@/shared/lib/ship-profile'
import { Field } from './AdminUI'

type ProfileChange =
  | [key: 'productionYear', value: number | null]
  | [key: (typeof shipProfileTextFields)[number]['key'], value: string]

export function ShipProfileFields({ profile, errors, disabled, onChange }: {
  profile: ShipProfile
  errors: Record<string, string>
  disabled: boolean
  onChange: (...change: ProfileChange) => void
}) {
  const prefix = useId()

  return <>
    {shipProfileTextFields.map(({ key, label, maxLength }) => (
      <Field key={key} htmlFor={`${prefix}-${key}`} label={label} error={errors[key]}>
        <input name={key} value={profile[key] ?? ''} maxLength={maxLength} disabled={disabled}
          onChange={event => onChange(key, event.target.value)} />
      </Field>
    ))}
    <Field htmlFor={`${prefix}-productionYear`} label={productionYearLabel} error={errors.productionYear}>
      <input name="productionYear" type="number" min={1} max={9999} step={1} disabled={disabled}
        value={profile.productionYear ?? ''} onChange={event => onChange('productionYear',
          event.target.value === '' ? null : event.target.valueAsNumber)} />
    </Field>
  </>
}
