import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { loadHomeCruises, type HomeLiveCruise } from '../model/public-booking'
import { BookingFaq } from '../components/LandingSections'
import { DestinationDiscovery } from '../components/PublicDestinations'
import { HomeFinder, HomeHero, HomeShipInvitation, LiveCruisesShowcase } from '../components/HomeShowcase'
import landing from '../components/Landing.module.css'
import styles from '../components/HomeShowcase.module.css'

export function HomePage() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ attempt: number; items: HomeLiveCruise[]; error: string } | null>(null)

  const load = useCallback(() => {
    setAttempt(value => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadHomeCruises(controller.signal)
      .then(items => {
        if (!controller.signal.aborted) {
          setState({ attempt, items, error: '' })
        }
      })
      .catch(cause => {
        if (!controller.signal.aborted) {
          setState({
            attempt,
            items: [],
            error: cause instanceof Error ? cause.message : 'Không thể kết nối để tải danh sách hải trình.',
          })
        }
      })
    return () => controller.abort()
  }, [attempt])

  const loading = state == null || state.attempt !== attempt
  const cruises = state?.attempt === attempt ? state.items : []
  const error = state?.attempt === attempt ? state.error : ''

  return <div className={`${landing.home} ${styles.page}`}>
    <HomeHero /><HomeFinder />
    <div className={styles.content}>
      <LiveCruisesShowcase cruises={cruises} loading={loading} error={error} onRetry={load} />
      <HomeShipInvitation cruises={cruises} />
      <DestinationDiscovery />
      <BookingFaq />
      <div className={styles.closing}><p>Hẹn bạn ở một hành trình mới.</p><Link className={styles.navyButton} to="/cruises">Khám phá các chuyến <span aria-hidden="true">↗</span></Link></div>
    </div>
  </div>
}
