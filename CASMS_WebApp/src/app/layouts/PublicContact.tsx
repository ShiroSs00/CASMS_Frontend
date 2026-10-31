import { useEffect, useRef, useState } from 'react'
import styles from './PublicLayout.module.css'

const projectContact = { phone: '09xx 686 888', email: 'ocevie.lucky88@gmail.com' }

export function PublicContact({ variant = 'button', id = 'project-contact' }: { variant?: 'nav' | 'button'; id?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

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
          <a href={`tel:${projectContact.phone.replace(/[\s().-]/g, '')}`} className={styles.modalCallBtn}>
            <span>Gọi {projectContact.phone}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>

          <a href={`mailto:${projectContact.email}`} className={styles.modalChatBtn}>
            <span>Chat / Gửi thư qua Gmail</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
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
