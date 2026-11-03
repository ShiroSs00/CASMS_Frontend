import styles from './BrandLogo.module.css'

/** Original OceVie artwork; retain its proportions and built-in clear space. */
export function BrandLogo({ variant = 'light', tagline = false }: { variant?: 'light' | 'dark'; tagline?: boolean }) {
  const filename = variant === 'dark' && tagline ? 'ocevie-horizontal-dark.svg' : `ocevie-horizontal-${variant}-no-tagline.svg`
  return <img className={styles.logo} src={`/branding/${filename}`} alt="OceVie Cruises" width={1200} height={360} />
}
