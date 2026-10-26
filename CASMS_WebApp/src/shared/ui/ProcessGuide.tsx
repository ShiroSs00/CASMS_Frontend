import styles from './ProcessGuide.module.css'

export function ProcessGuide({ label, steps }: { label: string; steps: readonly { title: string; description: string }[] }) {
  return <section className={styles.guide} aria-label={label}><span className={styles.label}>{label}</span><ol>{steps.map((step,index)=><li key={step.title}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>)}</ol></section>
}
