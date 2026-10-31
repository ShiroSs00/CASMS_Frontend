import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import experience from './Experience.module.css'
import styles from './Overlay.module.css'

let openCount = 0
let previousOverflow = ''

export function Modal({ title, description, onClose, busy = false, wide = false, large = false, children, footer, variant = 'modal', protectChanges = true }:
  { title: string; description?: string; onClose: () => void; busy?: boolean; wide?: boolean; large?: boolean; children: ReactNode; footer?: ReactNode; variant?: 'modal' | 'drawer'; protectChanges?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const dirty = useRef(false)
  const lastControl = useRef<HTMLElement | null>(null)
  const dismiss = useRef<HTMLButtonElement>(null)
  const closeControl = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const titleId = useId(), descriptionId = useId(), discardId = useId()
  useEffect(() => {
    const element = dialog.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (openCount++ === 0) {
      previousOverflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
    }
    element.showModal()
    return () => {
      element.close()
      if (--openCount === 0) document.documentElement.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    if (confirmDiscard) dismiss.current?.focus()
    else if (wasConfirming.current) {
      if (lastControl.current?.isConnected && !lastControl.current.matches(':disabled')) lastControl.current.focus({ preventScroll: true })
      else closeControl.current?.focus({ preventScroll: true })
    }
    wasConfirming.current = confirmDiscard
  }, [confirmDiscard])
  function requestClose() {
    if (busy) return
    if (protectChanges && dirty.current) setConfirmDiscard(true)
    else onClose()
  }
  function continueEditing() {
    if (busy) return
    setConfirmDiscard(false)
  }
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined}
    className={`${experience.overlay} ${styles.dialog} ${large ? styles.large : wide ? styles.wide : ''} ${variant === 'drawer' ? styles.drawer : ''}`}
    onChangeCapture={event => { dirty.current = true; if (event.target instanceof HTMLElement) lastControl.current = event.target }}
    onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest('[role="radio"][aria-checked="false"]')) {
        dirty.current = true
        lastControl.current = event.target.closest<HTMLElement>('[role="radio"]')
      }
      const target = event.target instanceof Element ? event.target.closest('[data-overlay-dismiss]') : null
      if (target && (busy || (protectChanges && dirty.current))) { event.preventDefault(); event.stopPropagation(); requestClose() }
    }}
    onCancel={event => { event.preventDefault(); if (confirmDiscard) continueEditing(); else requestClose() }}>
    <div className={`${styles.frame} ${confirmDiscard ? styles.confirming : ''}`}>
      <header className={styles.header}><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button ref={closeControl} type="button" autoFocus aria-label="Đóng hộp thoại" disabled={busy} className={styles.close} onClick={requestClose}>×</button>
      </header>
      <div className={styles.body} inert={confirmDiscard}>{children}</div>
      {footer && <footer className={styles.footer} inert={confirmDiscard}>{footer}</footer>}
      {confirmDiscard && <section className={styles.discard} aria-label="Thay đổi chưa lưu">
        <p id={discardId}>Biểu mẫu có thay đổi chưa lưu. Đóng sẽ bỏ những thay đổi này.</p>
        <div className={styles.discardActions}>
          <button ref={dismiss} type="button" className={styles.keepEditing} aria-describedby={discardId} disabled={busy} onClick={continueEditing}>Tiếp tục chỉnh sửa</button>
          <button type="button" className={styles.discardButton} aria-describedby={discardId} disabled={busy} onClick={onClose}>Bỏ thay đổi và đóng</button>
        </div>
      </section>}
    </div>
  </dialog>
}
