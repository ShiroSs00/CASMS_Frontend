import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError, apiRequest } from '@/shared/api'
import { Button, Loading, Notice } from '@/shared/ui'
import { decodeDestinations, destinationPhoto, type PublicDestination } from '../model/public-destinations'
import styles from './PublicDestinations.module.css'

const countries = new Intl.DisplayNames(['vi'], { type: 'region' })

function DestinationCard({ destination }: { destination: PublicDestination }) {
  const photo = destinationPhoto(destination)
  const [failed, setFailed] = useState(false)
  return <article className={styles.card}>
    {photo && !failed && <div className={styles.photo}><img src={photo.src} alt={photo.alt} loading="lazy" width="1600" height="1067" onError={() => setFailed(true)} /><span>Ảnh địa danh</span></div>}
    <div className={styles.copy}><span className={styles.country}>{countries.of(destination.countryCode) ?? destination.countryCode}</span><h3>{destination.destinationName}</h3>
      {destination.description && <p>{destination.description}</p>}
      {destination.ports.length > 0 && <div className={styles.ports}><strong>Cảng tại điểm đến</strong><ul>{destination.ports.map((port,index) => <li key={`${port.portName}-${index}`}>{port.portName}</li>)}</ul></div>}
    </div>
  </article>
}

export function DestinationDiscovery() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ attempt: number; data?: PublicDestination[]; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<unknown>('/destinations/active', { signal: controller.signal, authenticated: false }).then(decodeDestinations).then(data => {
      if (!controller.signal.aborted) setState({ attempt, data })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ attempt, error: error instanceof ApiError && [401,403].includes(error.status) ? 'Hiện chưa thể truy cập danh sách điểm đến.' : 'Chưa tải được điểm đến. Vui lòng kiểm tra kết nối và thử lại.' })
    })
    return () => controller.abort()
  }, [attempt])
  const current = state?.attempt === attempt ? state : null
  return <section className={styles.section} id="destinations" aria-labelledby="destinations-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>ĐIỂM ĐẾN OCEVIE</p><h2 id="destinations-title">Khám phá những miền biển mới.</h2><p>Tìm hiểu điểm đến và các cảng trong danh mục. Các chuyến đang mở được hiển thị riêng trong trang hành trình.</p></div><Link to="/cruises">Xem hành trình đã công bố ↗</Link></div>
    <div className={styles.results} aria-busy={!current}>
      {!current ? <Loading label="Đang tải điểm đến…" /> : current.error ? <Notice tone="error" title="Chưa tải được điểm đến"><p>{current.error}</p><Button onClick={() => setAttempt(value => value + 1)}>Thử lại</Button></Notice> : current.data?.length ? <div className={styles.grid}>{current.data.map(destination => <DestinationCard key={destination.destinationId} destination={destination} />)}</div> : <Notice title="Chưa có điểm đến đang hoạt động">Vui lòng quay lại sau để khám phá các điểm đến mới.</Notice>}
    </div>
    <Link className={styles.credits} to="/images/ports/credits.html" reloadDocument target="_blank" rel="noreferrer">Nguồn ảnh & giấy phép ↗</Link>
  </section>
}
