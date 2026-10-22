import { HeroSection } from '../components/HeroSection'
import { AuroraExperience, BookingJourney, CruiseFinder, DestinationDiscovery, FeaturedVoyages, ShipStory, FinalCta } from '../components/LandingSections'
import styles from '../components/Landing.module.css'
export function HomePage() { return <div className={styles.home}><HeroSection/><div className={styles.container}><CruiseFinder/><FeaturedVoyages/><DestinationDiscovery/><AuroraExperience/><ShipStory/><BookingJourney/><FinalCta/></div></div> }
