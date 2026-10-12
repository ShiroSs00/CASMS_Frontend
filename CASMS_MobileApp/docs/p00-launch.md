# P00 · Passenger / Khởi động

Scope: UI only, as confirmed by the user. Route `/` renders the Passenger launch
screen. Session restoration, minimal app data and navigation to onboarding/login
or Passenger Home must be connected when their API contracts and routes exist.
Until then P00 remains visible; it does not simulate authentication or progress.

- Portrait reference: 412 × 892 dp; flexible layout, safe areas, system font,
  font scaling and scrolling for short screens or large accessibility text.
- Navy background and Ocean indicator use named CASMS Material color roles.
- Android uses the real indeterminate Material 3 Expressive `LoadingIndicator`
  via the existing `@expo/ui` Jetpack Compose bridge, without custom animation.
- iOS/web uses SVG outlines sampled from M3E Canvas and interpolated with
  Reanimated. It follows the seven-shape sequence and 650 ms morph cadence with
  combined rotation, using smooth easing without bounce. It runs locally in
  Expo Go without a WebView or remote content. Reduce Motion at app startup
  shows a stationary shape, and backgrounding cancels the animation.
- The native launch background is Navy, without the Expo splash image. Native
  splash configuration changes require a new binary to take effect.
- Hide the native launch screen after P00 layout, without an artificial timer.
- No tab bar, percentage, QR, personal data or staff controls on P00.

Reference: https://lnkiai.github.io/m3e-canvas/. Attribution and licenses are in
`docs/third-party/`. `react-native-svg` was added with `expo install` for SDK 57.

No emulator/device verification or APK build in this UI phase. `npm run lint`
requires ESLint and configuration, which the starter does not yet include.

Validation for the iPhone animation update:
- `npx --no-install tsc --noEmit`: passed.
- Web export and iOS Hermes bundle export: passed. iOS export required running
  outside the sandbox because Hermes could not write its temporary bytecode file.
- Geometry check: all seven outlines have 180 points; sampled animation paths
  stay within the 48 dp viewport; all 126 transitions and the repeat seam are
  continuous. This checks geometry, not on-device visual performance.
