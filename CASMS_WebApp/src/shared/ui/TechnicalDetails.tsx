import styles from './TechnicalDetails.module.css'

/** Keep exact server identifiers available for support without using them as names. */
export function TechnicalDetails({ entries, label = 'Thông tin kỹ thuật' }: {
  entries: ReadonlyArray<readonly [string, string | number | null | undefined]>
  label?: string
}) {
  return <details className={styles.details}>
    <summary>{label}</summary>
    <dl>{entries.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value == null || value === '' ? 'Chưa có định danh' : <code>{value}</code>}</dd></div>)}</dl>
  </details>
}
