import { PassengerNewBookingScreen } from '@/features/passenger-actions/PassengerBookingScreens';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
export default function NewBookingRoute() { return <AccountBoundScreen component={PassengerNewBookingScreen} />; }
