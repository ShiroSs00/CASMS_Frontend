import { useEffect, useRef, type ReactNode } from 'react'

import styles from './OperationalIssues.module.css'

type Props = {
  open: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

export function ActionDialog({ open, title, description, onClose, children, footer }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      <header className={styles.dialogHeader}>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className={styles.dialogBody}>{children}</div>
      <footer className={styles.dialogFooter}>{footer}</footer>
    </dialog>
  )
}
