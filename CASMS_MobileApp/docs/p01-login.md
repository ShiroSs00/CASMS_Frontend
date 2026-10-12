# P01 · Passenger / Đăng nhập

Mobile code requested by the user, overriding the pasted design-only template.
Expo Go on iPhone is the preview target. No backend or APK in this UI phase.

App entry opens /login directly. P00 is preserved at /splash, without a simulated
delay or session restoration.

The form starts empty. Required and email-format validation, floating labels,
password visibility, keyboard avoidance, responsive scrolling, named light color
roles and Material Symbols Rounded are supported. Invalid input disables submit.
Loading disables editing and actions; a synchronous guard blocks double submit.
Error/offline outcomes retain input. Passwords are never persisted or logged.

PassengerLoginScreen accepts a signIn adapter returning success,
incorrect-credentials or offline. Its default is a UI prototype: any locally
valid input navigates to /home (now implemented by P02). No session is created.
Production authentication must replace this adapter after API confirmation.

Preview states: /login?state=loading, error, offline or expired. These change
presentation only. Loading stays locked; other states allow editing and prototype
retry with valid inputs. Adapter failure preserves input without navigation.

/forgot-password and /support open labeled future-view placeholders with working
return actions. They send no requests and invent no contact information.
P02 Home was subsequently implemented on the same combined branch.

Validation:
- TypeScript: passed.
- ESLint for app routes, Passenger components, auth feature and light theme: passed.
- Web export and iOS Hermes bundle export: passed.
- Browser check at 393 x 852: invalid email disables submit; password visibility,
  prototype success navigation, recovery/support navigation and return actions
  work; loading locks controls, expired/offline messages render without overflow.
- Full-app lint reports the pre-existing template hook's set-state-in-effect
  error in src/hooks/use-color-scheme.web.ts. That hook was not changed here.
- No emulator, device or signed release build was run.

Expo's SDK-matched ESLint dependencies and configuration were added so Mobile
can run its lint command. Material icon licenses remain in docs/third-party/.
