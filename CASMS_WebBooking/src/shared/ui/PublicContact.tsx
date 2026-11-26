import { useEffect, useRef, useState } from 'react'
import styles from './PublicContact.module.css'

const projectContact = { email: 'ocevie.lucky88@gmail.com' }

export function PublicContact({ variant = 'button', id = 'project-contact' }: { variant?: 'nav' | 'button'; id?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (id !== 'header-contact') return
    const openFromTrigger = () => setOpen(true)
    const onHash = () => {
      if (window.location.hash === '#header-contact') setOpen(true)
    }
    window.addEventListener('ocevie:open-contact', openFromTrigger)
    window.addEventListener('hashchange', onHash)
    if (window.location.hash === '#header-contact') setOpen(true)
    return () => {
      window.removeEventListener('ocevie:open-contact', openFromTrigger)
      window.removeEventListener('hashchange', onHash)
    }
  }, [id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return <div ref={root} className={variant === 'nav' ? styles.navContactWrap : styles.contactWrap}>
    <button
      ref={trigger}
      id={id}
      className={variant === 'nav' ? styles.navContactLink : styles.pillContactBtn}
      type="button"
      aria-expanded={open}
      aria-controls={`${id}-modal`}
      onClick={() => setOpen(value => !value)}
    >
      <span>Liên hệ</span>
      <svg className={styles.chevronIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>

    {open && <div className={styles.contactModalBackdrop} onClick={() => setOpen(false)}>
      <div
        className={styles.contactModalCard}
        id={`${id}-modal`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id={`${id}-title`} className={styles.modalTitle}>Liên hệ hỗ trợ</h2>
          <button
            type="button"
            className={styles.modalCloseBtn}
            aria-label="Đóng bảng liên hệ"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <p className={styles.modalSubtitle}>Chọn phương thức hỗ trợ bạn mong muốn bên dưới</p>

        <div className={styles.modalActions}>
          <a href={`mailto:${projectContact.email}?subject=Hỗ%20trợ%20đặt%20chỗ%20OceVie`} className={styles.modalCallBtn}>
            <span>Gửi email hỗ trợ ({projectContact.email})</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </a>

          <a href="/booking/lookup" className={styles.modalChatBtn} onClick={() => setOpen(false)}>
            <span>Tra cứu mã đặt chỗ trực tuyến</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </a>
        </div>

        <div className={styles.modalFooterNote}>
          <small>Hỗ trợ giải đáp hành trình, đặt chỗ và dịch vụ OceVie 24/7</small>
        </div>
      </div>
    </div>}
  </div>
}
