import type { BookingModelRenderer } from '../components/BookingShipModel'
import { RealBookingCreatePage } from './RealBookingCreatePage'
export function TravellerDetailsPage(){return <RealBookingCreatePage step={2}/>}
export function CabinExperiencePage({renderShipModel}:{renderShipModel?:BookingModelRenderer}){return <RealBookingCreatePage step={1} renderShipModel={renderShipModel}/>}
export function ReviewBookingPage(){return <RealBookingCreatePage step={3}/>}
