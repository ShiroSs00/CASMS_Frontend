import { BookingAccountActivationPage } from '@/features/account-activation'
import { activationLink } from './activation-entry'
import { PublicContact } from './layouts/PublicContact'

export function AccountActivationRoute() {
  return <BookingAccountActivationPage link={activationLink} support={<PublicContact id="activation-support" variant="nav" />} />
}
