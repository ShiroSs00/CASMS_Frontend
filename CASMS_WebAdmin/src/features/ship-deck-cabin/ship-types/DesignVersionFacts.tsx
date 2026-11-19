import type { ShipDesignReference } from '../model/types'
import { manufacturingFields } from './design-metadata'
import styles from './ShipWork.module.css'

export function DesignVersionFacts({ design, showReference = true }: { design: ShipDesignReference; showReference?: boolean }) {
  return <>
    <p>{showReference ? 'Lấy từ thiết kế ZIP' : 'Thông tin từ tệp thiết kế.'}</p>
    <dl className={styles.facts}>
      {showReference && <>
        <div><dt>Mã mô hình</dt><dd>{design.modelKey}</dd></div>
        <div><dt>Phiên bản thiết kế</dt><dd>{design.assetVersion}</dd></div>
      </>}
      {manufacturingFields.map(({ key, label }) => <div key={key}>
        <dt>{label}</dt><dd>{design.manufacturingMetadata?.[key] ?? (showReference ? 'Chưa có trong ZIP' : 'Chưa cung cấp')}</dd>
      </div>)}
    </dl>
  </>
}
