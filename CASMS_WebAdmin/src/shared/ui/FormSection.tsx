import { useId, type ReactNode } from 'react'
import styles from './FormSection.module.css'

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const titleId = useId()
  return <section className={styles.section} aria-labelledby={titleId}>
    <header><h3 id={titleId}>{title}</h3>{description && <p>{description}</p>}</header>
    <div className={styles.fields}>{children}</div>
  </section>
}
