# OceVie design and motion review

Initial motion review: 20 October 2026. Branch: `feat/mobile-passenger-live-api`.

## Production/API follow-up — 21 October 2026

The shipping app now requires real authentication and has no demo/mock path. The
center tab is Bookings; unsupported QR/check-in/spending entries were removed.
The older synthetic UI scenarios below document how the motion regression was
found; they are not the app runtime. Marketing and technical explanatory copy has
been shortened. See real-api-qa.md for current real Spring Boot/PostgreSQL evidence.
The opacity/transform fix, cancellation logic and reduced-motion support remain.

## Design reference

The existing OceVie identity in `src/constants/ocevie.ts`, approved logo assets and
`docs/ocevie-mobile-ux.md` are the reference: pearl background, navy headings, teal
actions, restrained gold accents, system fonts with Vietnamese support, 20 px cards,
14 px buttons and a 600 px maximum content width.

The passenger booking, activity, service and package screens now use a common
introduction, icon, typography and spacing. Booking and activity/service statuses use
semantic badges. Selection fields have clear affordances and selected radio states.
Dates use short local times without seconds. Live Home keeps the voyage summary
near the top and exposes booking/activity shortcuts through the existing OceVie rows.

## Motion behavior

- One shared `PassengerSheet` for itinerary demo/live, discovery, notifications,
  account, booking and other passenger actions. The backdrop fades while the panel
  moves 48 px into place: 260 ms in, 200 ms out. Native Modal fade is disabled so it
  does not compete with the panel animation.
- The last visible title/content is retained throughout exit. Interrupted exits stop
  their animation; stale completion callbacks cannot hide a reopened sheet. Controls
  and the backdrop are disabled while a request is pending. Exiting panels stop
  accepting pointer events. iOS sheets use keyboard avoidance and scrollable forms.
- Itinerary detail panels keep an expanded height when navigating between nested
  views. Their scroll position resets when the view changes, so the next heading is
  visible rather than inheriting the previous panel's scrolled position.
- Entrances animate opacity and a 12 px translation, without changing layout.
  Native builds use the native animation driver. The browser uses RN's web driver.
  Buttons scale gently to .985 and keep their original corner radius. Interrupted
  presses reset when disabled or reduced motion is enabled.
- Tab screens crossfade over 160 ms; stack details retain directional navigation.
  Tab state is preserved. One application-level accessibility subscription follows
  reduced-motion changes. Motion durations become zero and navigation animations
  are disabled when reduced motion is requested. Android's launch indicator has a
  static fallback. Repeating launch motion stops while the app is inactive.

## Regression found during UI testing

Rapid tab switching at 320 px interrupted Reanimated's web entering-layout effect.
The intro wrapper was left absolutely positioned with width/height zero, causing
the heading to render as a thin column over other controls. Measured heading width
was 0 px. Replacing these layout entrances with opacity/transform animations fixed
it; the same rapid-switch sequence then measured 265 px, the expected content width
after gutters and the browser scrollbar. Daily itinerary entrances use the same fix.

## Checks performed

- Node suite: 46 tests passed, including four new lifecycle regressions covering
  delayed exits, canceled callbacks, repeated interruptions, instant completion and
  unmount cleanup. The existing API/session tests still pass.
- TypeScript noEmit, Expo lint and git diff --check passed.
- Browser at 320 x 740 and 390 x 844: booking introduction/creation, cruise and cabin
  selection, opening/closing selection sheets six times, services, form input,
  invalid quantity, successful submission, status badges, package selection layout
  and account confirmation/cancel/sign-out.
- Rapid switching: three initial rounds through all five tabs exposed the bug above;
  five further rounds (25 tab changes) passed after the fix. Search text and its
  empty-result state survived tab changes.
- Demo itinerary: 16 rapid day changes, return to day two and opening its tour detail.
- Tablet at 768 x 1024: modal width measured 600 px, centered at x=84.
- The optional local fixture's `slow` scenario delays responses by 900 ms. Verified
  disabled submit/close/inputs while pending, automatic exit and the personal request
  list after success. Its `service-error` scenario returns 503 for the catalogue;
  verified a visible error/retry action and successful recovery after restoring the
  normal scenario. All mutations used synthetic in-memory data only.

Screenshots are in `.expo/ocevie-motion-qa/` (ignored local QA artifacts).

## Reproduce the browser scenarios

Run `node tests/fixtures/passenger-api-server.mjs`. To exercise slow responses or an
API error, set `UI_FIXTURE_SCENARIO` to `slow` or `service-error` for that process.
Use the fixture setup described in `docs/passenger-live-api.md`; restart the fixture
between scenarios. The app does not import the fixture or its scenario settings.

## Limits and native follow-up

Browser checks and JS/Hermes exports do not establish native frame rate. No claim
of 60/120 FPS, real-device keyboard behavior or completed native accessibility
testing is made. On iOS and Android release builds, still check rapid tab/day
changes, interrupted presses, nested sheets, keyboard plus safe areas, hardware
back, screen readers, large text and changing Reduce Motion while the app is open.
Real BE/database integration is separate from this synthetic UI test workflow.

Implementation references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo Stack](https://docs.expo.dev/router/advanced/stack/),
[React Native Animated](https://reactnative.dev/docs/animated),
[keyboard avoidance](https://reactnative.dev/docs/keyboardavoidingview),
[Reanimated reduced motion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/).
