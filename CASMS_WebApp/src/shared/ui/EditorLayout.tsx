import type { ReactNode } from 'react'
import styles from './EditorLayout.module.css'

export function EditorLayout({ children, guidance, title = 'Trước khi lưu' }: {
  children: ReactNode; title?: string; guidance: readonly { title: string; description: string }[]
}) {
  return <div className={styles.layout}>
    <div className={styles.content}>{children}</div>
    <aside className={styles.guide} aria-label={title}>
      <span className={styles.eyebrow}>OCEVIE · HƯỚNG DẪN</span><h2>{title}</h2>
      <ul>{guidance.map(item => <li key={item.title}><strong>{item.title}</strong><p>{item.description}</p></li>)}</ul>
      <p className={styles.note}>Kiểm tra kết quả thông báo sau khi lưu trước khi rời trang.</p>
    </aside>
  </div>
}
