import type { ReactNode } from 'react'
import { AdminShell } from '@/shared/ui/admin-v3'

import styles from './OperationalIssues.module.css'

export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <AdminShell className={styles.appShell}>
      <div className={styles.content}>{children}</div>
    </AdminShell>
  )
}
