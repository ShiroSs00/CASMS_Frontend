import type { ShipDesignReference } from '../model/types'
import { manufacturingFields } from './design-metadata'
import styles from './ShipWork.module.css'

export function DesignVersionFacts({ design }: { design: ShipDesignReference }) {
  return <>
    <p>Lấy từ thiết kế ZIP</p>
    <dl className={styles.facts}>
      <div><dt>Mã mô hình</dt><dd>{design.modelKey}</dd></div>
      <div><dt>Phiên bản thiết kế</dt><dd>{design.assetVersion}</dd></div>
      {manufacturingFields.map(({ key, label }) => <div key={key}>
        <dt>{label}</dt><dd>{design.manufacturingMetadata?.[key] ?? 'Chưa có trong ZIP'}</dd>
      </div>)}
    </dl>
  </>
}
