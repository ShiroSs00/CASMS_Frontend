import type { ReactNode } from 'react'
import { Modal } from '@/shared/ui'
import styles from './OperationalIssues.module.css'

type Props = { open: boolean; pending?: boolean; error?: string; title: string; description: string; onClose: () => void; children: ReactNode; footer: ReactNode }

export function ActionDialog({ open, title, description, onClose, children, footer, pending, error }: Props) {
  return open ? <Modal title={title} description={description} onClose={onClose} busy={pending} footer={footer}>
    {children}{error && <div className={styles.errorBanner} role="alert">{error}</div>}
  </Modal> : null
}
