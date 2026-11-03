import { BookingProvider } from '@/features/booking'
// Guest drafts and quote intents belong only to this application instance.
export function BookingSessionLayout() { return <BookingProvider /> }
