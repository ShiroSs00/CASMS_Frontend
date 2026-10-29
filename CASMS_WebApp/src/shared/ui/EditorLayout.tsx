import type { ReactNode } from 'react'
import styles from './EditorLayout.module.css'

export function EditorLayout({ children }: {
  children: ReactNode; title?: string
}) {
  return <div className={styles.layout}>
    <div className={styles.content}>{children}</div>
  </div>
}
