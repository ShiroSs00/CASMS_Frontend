import { useEffect, useRef, useState } from 'react'
import styles from './PublicLayout.module.css'

// Suggested branding only; enable links after the project owns these channels.
const projectContact = { phone: '09xx 686 888', email: 'ocevie.lucky88@gmail.com', verified: false }

export function PublicContact() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div ref={root} className={styles.contact} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); event.stopPropagation() } }}>
    <button ref={trigger} id="project-contact" className={styles.contactLink} type="button" aria-expanded={open} aria-controls="project-contact-details" onClick={() => setOpen(true)}>Liên hệ</button>
    {open && <div className={styles.contactDetails} id="project-contact-details" role="region" aria-label="Liên hệ OceVie">
      <strong>Liên hệ OceVie</strong>
      <span>Điện thoại</span>
      {projectContact.verified ? <a href={'tel:' + projectContact.phone.replace(/[\s().-]/g, '')}>{projectContact.phone}</a> : <p>{projectContact.phone}</p>}
      <span>Gmail</span>
      {projectContact.verified ? <a href={'mailto:' + projectContact.email}>{projectContact.email}</a> : <p>{projectContact.email}</p>}
      {!projectContact.verified && <small>Thông tin liên hệ mẫu · Chưa kích hoạt</small>}
    </div>}
  </div>
}
