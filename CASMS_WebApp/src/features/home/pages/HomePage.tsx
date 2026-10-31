import { Link } from 'react-router'
import { BookingFaq } from '../components/LandingSections'
import { DestinationDiscovery } from '../components/PublicDestinations'
import { HolidayChoices, HomeFinder, HomeHero, HomeShipInvitation } from '../components/HomeShowcase'
import landing from '../components/Landing.module.css'
import styles from '../components/HomeShowcase.module.css'

export function HomePage() {
  return <div className={`${landing.home} ${styles.page}`}>
    <HomeHero /><HomeFinder />
    <div className={styles.content}>
      <HolidayChoices /><DestinationDiscovery /><HomeShipInvitation /><BookingFaq />
      <div className={styles.closing}><p>Hẹn bạn ở một hành trình mới.</p><Link className={styles.navyButton} to="/cruises">Khám phá các chuyến <span aria-hidden="true">↗</span></Link></div>
    </div>
  </div>
}
