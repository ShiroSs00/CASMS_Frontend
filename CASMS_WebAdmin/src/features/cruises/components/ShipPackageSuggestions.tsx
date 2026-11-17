import { useId } from 'react'
import { useShipPackageTemplates } from '@/domain/cruise-package'
import { cabinTypeLabel } from '@/shared/i18n/business-copy'
import { Button } from '@/shared/ui'
import styles from './Cruises.module.css'

export function ShipPackageSuggestions({ shipId }: { shipId: string }) {
  const titleId = useId()
  const templates = useShipPackageTemplates(shipId)
  return <section className={styles.shipPackageSuggestions} aria-labelledby={titleId} aria-busy={templates.loading}>
    <h3 id={titleId}>Mẫu gói của tàu</h3>
    {templates.loading ? <p role="status">Đang tìm mẫu gói…</p>
      : templates.error ? <><p role="status">Chưa tải được mẫu gói. Bạn vẫn có thể tạo tour.</p>
        <Button tone="text" size="compact" onClick={templates.retry}>Tải lại mẫu gói</Button></>
      : templates.data?.length ? <>
        <ul>{templates.data.map(template => <li key={template.templateVersionId}>
          <strong>{template.name}</strong>
          <span>{template.cabinTypes.map(cabinTypeLabel).join(', ')}</span>
        </li>)}</ul>
        <p>Quản lý dịch vụ sẽ cấu hình gói sau khi bạn tạo tour.</p>
      </> : <p>Tàu này chưa có mẫu gói đã phát hành. Bạn vẫn có thể tạo tour.</p>}
  </section>
}
