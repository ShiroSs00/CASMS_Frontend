import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import experience from './Experience.module.css'
import styles from './Overlay.module.css'

let openCount = 0
let previousOverflow = ''

export function Modal({ title, description, onClose, busy = false, wide = false, large = false, children, footer, variant = 'modal', quiet = false }:
  { title: string; description?: string; onClose: () => void; busy?: boolean; wide?: boolean; large?: boolean; children: ReactNode; footer?: ReactNode; variant?: 'modal' | 'drawer'; quiet?: boolean; protectChanges?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeControl = useRef<HTMLButtonElement>(null)
  const titleId = useId(), descriptionId = useId()
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
  function requestClose() {
    if (busy) return
    onClose()
  }
  function keepTabFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const element = event.currentTarget
    const controls = Array.from(element.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"]',
    )).filter(control => control.tabIndex >= 0 && !control.matches(':disabled, input[type="hidden"]')
      && !control.closest('[inert]') && control.checkVisibility({ visibilityProperty: true }))
    const first = controls[0]
    const last = controls.at(-1)
    const active = document.activeElement
    const boundary = event.shiftKey ? first : last
    if (!first || !last || active === element || !element.contains(active)
      || active === boundary) {
      event.preventDefault()
      const next = event.shiftKey ? last : first
      next?.focus()
    }
  }
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined}
    className={`${experience.overlay} ${styles.dialog} ${large ? styles.large : wide ? styles.wide : ''} ${variant === 'drawer' ? styles.drawer : ''} ${quiet ? styles.quiet : ''}`}
    onKeyDown={keepTabFocus}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); requestClose() }}>
    <div className={styles.frame}>
      <header className={styles.header}><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button ref={closeControl} type="button" aria-label="Đóng hộp thoại" disabled={busy} className={styles.close} onClick={requestClose}>{quiet ? 'Đóng' : '×'}</button>
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  </dialog>
}
