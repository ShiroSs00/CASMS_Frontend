import type { ReactNode } from 'react'
import styles from './RecordFacts.module.css'

export function RecordFacts({ entries }: { entries: readonly (readonly [string, ReactNode])[] }) {
  return <dl className={styles.facts}>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
