import { HeroSection } from '../components/HeroSection'
import { OceVieExperience, BookingJourney, CruiseFinder, DestinationDiscovery, FeaturedVoyages, ShipStory, FinalCta } from '../components/LandingSections'
import styles from '../components/Landing.module.css'
export function HomePage() { return <div className={styles.home}><HeroSection/><CruiseFinder/><div className={styles.container}><DestinationDiscovery/><OceVieExperience/><FeaturedVoyages/><ShipStory/><BookingJourney/><FinalCta/></div></div> }
