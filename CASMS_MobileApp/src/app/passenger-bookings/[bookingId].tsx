import { PassengerBookingDetailScreen } from '@/features/passenger-actions/PassengerBookingScreens';
import { AccountBoundScreen } from '@/features/passenger-actions/AccountBoundScreen';
export default function BookingDetailRoute() { return <AccountBoundScreen component={PassengerBookingDetailScreen} />; }
