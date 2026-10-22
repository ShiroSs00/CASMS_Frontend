# OceVie Cruises — Logo Kit v1.0

**Brand:** OceVie = **Ocean + Vietnam**. **Tagline:** From Vietnam to the Ocean.

## Design sources
- **Chim Lạc:** derived from the actual reference image supplied by the user (long upturned beak and geometric Đông Sơn styling). The logo is a cleaned **vector reinterpretation** of the supplied raster, not a claim of museum-accurate reconstruction.
- **Trống đồng:** derived from the user's supplied detailed circular Đông Sơn drum photo, simplified for scalable screen reproduction.

## Output structure
- `01-SVG/brand/`: scalable transparent vector primary/stacked/horizontal/symbol and wordmarks, light/dark + one-color alternatives.
- `01-SVG/icons/`: app icons and vector favicon.
- `02-PNG/web/`: 1600 px horizontal, 1000 px stacked, PNG with transparent or solid backgrounds, favicons and multi-size ICO.
- `02-PNG/mobile/`: iOS 1024px, Android 512, Android adaptive foreground/background 432, Android monochrome, PWA 192/512, Apple touch 180, splash 1200x1600.
- `02-PNG/social/`: Open Graph cover 1200x630.
- `03-Implementation/`: theme colors, sample Expo configuration, CSS colors.
- `04-Preview/`: sample board for picking a variant.

## Which file should I use?
- **Light web header (white/pearl page):** `01-SVG/brand/ocevie-horizontal-light-no-tagline.svg`
- **Dark web header (navy page):** `01-SVG/brand/ocevie-horizontal-dark-no-tagline.svg`
- **Footer / landing hero:** horizontal with tagline, matching background color.
- **Mobile splash:** `02-PNG/mobile/splash-brand-1200x1600.png`.
- **iOS and Android store listing:** `02-PNG/mobile/ios-app-icon-1024.png` and `android-legacy-icon-512.png`.
- **Android adaptive:** configure foreground with background `#0B2A4A` in Expo / Android.
- **Web browser icon:** `/02-PNG/web/favicon.ico`, PWA icons `/02-PNG/mobile/pwa-icon-{192,512}.png`.

## Accessibility / production guidance
- Do not display the dense drum engraving at 16 px. The small mark uses reduced ring details.
- Do not stretch the logo. Keep clear space at least 15% of emblem diameter around it.
- Dark SVGs are intended for navy/dark backgrounds; light SVGs are intended for pearl/white.
- PNG deliverables can be used directly; SVG path-based text needs no installed brand fonts.
- `icon` is used as a square canvas without pre-rounded corners, suitable for iOS and app stores.
- This is a concept design ready for app/web prototypes. Manual quality assurance and trade-mark/legal rights review are needed before final commercial deployment.
