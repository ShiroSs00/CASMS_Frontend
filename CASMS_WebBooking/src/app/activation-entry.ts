import { captureActivationLink } from '@/features/account-activation'

// This module evaluates before createBrowserRouter captures the initial location.
export const activationLink = captureActivationLink(window)
