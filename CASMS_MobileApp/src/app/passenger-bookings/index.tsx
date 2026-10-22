import { PassengerBookingsScreen } from '@/features/passenger-actions/PassengerBookingScreens';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
export default function BookingsRoute() { return <AccountBoundScreen component={PassengerBookingsScreen} />; }
