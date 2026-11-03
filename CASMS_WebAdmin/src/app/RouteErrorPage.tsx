import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { BrandLogo } from '@/shared/ui'
import styles from './RouteErrorPage.module.css'

export function RouteErrorPage() {
  const error=useRouteError()
  const missing=isRouteErrorResponse(error)&&error.status===404
  return <main className={styles.page}>
    <Link to="/" reloadDocument aria-label="Trang chủ OceVie"><BrandLogo /></Link>
    <title>{missing ? 'OceVie — Không tìm thấy trang' : 'OceVie — Chưa thể mở trang'}</title>
    <section><p className={styles.eyebrow}>{missing ? '404 · KHÔNG TÌM THẤY' : 'OCEVIE · CẦN THỬ LẠI'}</p>
      <h1>{missing?'Không tìm thấy trang':'Chưa thể mở trang này'}</h1>
      <p>{missing?'Đường dẫn có thể đã thay đổi. Về trang chủ để tiếp tục tìm hành trình.':'Vui lòng tải lại trang hoặc quay về trang chủ để tiếp tục.'}</p>
      <div><button type="button" onClick={()=>window.location.reload()}>Tải lại trang</button><Link to="/" reloadDocument>Về trang chủ</Link></div>
    </section>
  </main>
}
