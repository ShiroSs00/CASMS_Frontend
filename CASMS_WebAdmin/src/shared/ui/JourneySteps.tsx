import { PermissionLink as Link } from './PermissionLink'
import styles from './JourneySteps.module.css'

export function JourneySteps({ current, cruiseId, itineraryId, onStep }: { current: number; cruiseId?: string; itineraryId?: string; onStep?: (step: number) => void }) {
  return <nav aria-label="Các bước lập chuyến" className={styles.steps}><ol>{['Thông tin chuyến', 'Tuyến tàu', 'Chương trình', 'Kiểm tra'].map((label, index) => {
    const to = index === 0 && cruiseId ? `/admin/cruises/${cruiseId}/edit` : index > 0 && itineraryId ? `/admin/itineraries/${itineraryId}?step=${index}` : undefined
    return <li key={label} aria-current={current === index ? 'step' : undefined}>
      {onStep && index > 0 ? <button type="button" onClick={() => onStep(index)}><span>{index + 1}</span>{label}</button>
        : to ? <Link to={to}><span>{index + 1}</span>{label}</Link> : <span className={styles.label}><span>{index + 1}</span>{label}</span>}
    </li>
  })}</ol></nav>
}
