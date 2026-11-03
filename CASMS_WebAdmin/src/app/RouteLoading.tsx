import { BrandLogo, Loading } from '@/shared/ui'
import styles from './RouteErrorPage.module.css'

export function RouteLoading() {
  return <main className={styles.loading} aria-busy="true"><BrandLogo /><Loading label="Đang tải trang…" /></main>
}
