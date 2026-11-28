import type { ShipDesignReference } from '../model/types'
import { manufacturingFields } from './design-metadata'
import styles from './ShipWork.module.css'

const regionNames = new Intl.DisplayNames(['vi'], { type: 'region' })

function formatCountryName(code: string) {
  const upper = code.trim().toUpperCase()
  if (!upper) return ''
  try {
    return regionNames.of(upper) ?? upper
  } catch {
    return upper
  }
}

export function DesignVersionFacts({ design, showReference = true }: { design: ShipDesignReference; showReference?: boolean }) {
  return (
    <dl className={styles.facts}>
      {showReference && <>
        <div><dt>Mã mô hình</dt><dd>{design.modelKey}</dd></div>
        <div><dt>Phiên bản thiết kế</dt><dd>{design.assetVersion}</dd></div>
      </>}
      {manufacturingFields.map(({ key, label }) => {
        const raw = design.manufacturingMetadata?.[key]
        const display = key === 'buildCountry' && typeof raw === 'string' && raw.trim()
          ? formatCountryName(raw)
          : raw
        return (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{display ?? (showReference ? 'Chưa có trong ZIP' : 'Chưa cung cấp')}</dd>
          </div>
        )
      })}
    </dl>
  )
}
