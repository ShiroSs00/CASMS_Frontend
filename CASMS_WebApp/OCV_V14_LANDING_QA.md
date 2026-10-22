# V14 — Landing Page & Booking Entry

21/10/2026. **Landing/fixture UI PASS; LIVE E2E BLOCKED.** Implemented directly, no Backend/DB/Flyway/Admin/auth/Booking business/API edits, no new dependencies or real Booking mutations. No branch switch, commit or push.

Baseline: branch `codex/ocv-booking-ux-admin-logout-v7`, HEAD `e58770aa954be2508b5aedd0d7843e9890c74a28`. Snapshot + SHA-256 manifest of 50 pre-existing dirty files: `C:/Users/USER/AppData/Local/Temp/ocv-v14-baseline-9o04awj0`. Of those files, only the authorized Home `LandingSections.tsx` changed; other 49 remain byte-identical. Four other production files were clean at baseline and edited within the V14 contract. V11–V13 Booking source/tests/fixtures/reports remain unchanged. Contract: `docs/tasks/WEB-HOME-V14.md`.

## Five evidenced issues addressed

| Priority | Before / evidence | Implemented result |
| --- | --- | --- |
| P0 entry integrity | Finder supports real `cruiseType`, but uncontrolled default resets to All after browser Back. New regression failed `'' !== 'ONE_DAY'`. | Whitelist ONE_DAY/MULTI_DAYS; Home URL stores selection with replace and no scroll reset. Submit maps only supported values to `/cruises?cruiseType=...`. Back/Forward retains the selected type. |
| P0 content integrity | Three editorial cards all link to MULTI_DAYS, destination cards imply location-specific results while all link to the unfiltered catalogue. Examples still carry unused invented rates/dates in their model. | Editorial articles, explicit image/inspiration labels, no bookable-detail links or fabricated prices/dates. Separate truthful catalogue CTAs. Explain that destination filtering is unavailable. No hidden live-to-mock fallback. |
| P1 CTA/content accuracy | “Xem tàu” and “Khám phá trải nghiệm” both land on generic cruise search; “Ocean Voyager” name/image asserts an unverified ship. | Copy describes actual journey selection and per-cruise ship information, uses illustrative alt text, and names CTA destinations accurately. No fleet/ship/service availability asserted from editorial assets. |
| P1 guest navigation/action clarity | Header/footer management directs guests to guarded `/my-bookings`; footer Help/Terms/Privacy buttons only show an unverifiable support instruction. | Header “Tra cứu bằng mã” and Home lookup CTAs use `/booking/lookup`. Unsupported footer buttons replaced by working preparation/finder links. Authenticated My Bookings remains available in the existing account menu; guards/auth were not modified. |
| P1 visual/accessibility | Hero eyebrow navy `rgb(18,48,66)` over dark image; two similarly styled hero actions; destination labels over weak bottom overlay; small crowded footer links. | Clear cruise headline, one cream primary action, readable gold eyebrow/dark image treatment, named finder with associated hint, stronger destination text overlay, navy/cream focus outlines, consistent card spacing and44px footer targets. Existing navy/cream/gold identity/assets/section order retained. |

## Route / CTA matrix

All **24 active Home anchors** were activated in the browser (skip link by keyboard). The finder was submitted separately with both types and invalid/all controls. Dataful cases below use the explicit V13 preview server on5177 with `UI PREVIEW — NO LIVE BACKEND`; no responses are presented as live evidence.

| Entry | Tested destination / behavior | Result |
| --- | --- | --- |
| Hero “Tìm chuyến” | `#cruise-finder`, real form target; secondary → `#destinations` | PASS |
| Finder ONE_DAY / MULTI_DAYS | `/cruises?cruiseType=...` → GET `/api/cruise` with same type, `status=PUBLISHED`, expected fixture rows; Back retains selection, Forward recovers results | PASS |
| Finder All / invalid query value | `/cruises`, no unsupported type forwarded | PASS |
| Search → detail → Booking | Verified fixture UUID in detail, `from` retains type, same ID preselected in cabin form, guest reaches `/booking/travellers` and required representative email without login | PASS (fixture only) |
| Featured / destination catalogue CTA | `/cruises` unfiltered, editorial cards are articles; no false region filter or editorial slug detail link | PASS |
| Header destinations/experience + footer anchors | Existing real Home section IDs; brand → `/`; Login → actual login page | PASS |
| Ship / experience / final CTA | `/cruises`, names explicitly describe browsing voyages/ship information or choosing rooms | PASS |
| Finder / header / preparation / footer lookup | `/booking/lookup`, actual guest form; no automatic lookup request | PASS |
| Illustrative slug direct navigation | `/cruises/ha-long-lan-ha` → truthful unavailable state, no API detail request for invalid UUID | PASS |
| Loading / empty /401 /403 /502 /Retry | Downstream status/error/empty, no raw server text or fixture fallback; retry returns fixture catalogue when restored | PASS (controlled fixtures) |
| Actual anonymous finder request via FE5173 | GET `/api/cruise?status=PUBLISHED&page=0&size=6&sort=departureDatetime%2Casc&cruiseType=ONE_DAY` → **502** | BLOCKED live data; error + Retry verified |

No new Home inventory request is made: this Landing uses explicitly editorial content; the real inventory API is called on search/detail. The Home form exposes only the supported type filter. BE `ship/controller/CruiseController.java:48` accepts CruiseCruiseType; existing FE `liveCruiseCatalogApi.list` maps it unchanged. No Booking adapter changes were needed.

## Changed files

- `src/features/home/components/HeroSection.tsx` — clear offering/primary anchor/illustrative imagery.
- `src/features/home/components/LandingSections.tsx` — URL-backed finder, editorial articles, accurate CTAs, guest lookup, functional footer.
- `src/features/home/components/Landing.module.css` — scoped contrast/focus/hierarchy/card/footer/layout refinement.
- `src/features/home/model/public-booking.ts` — remove example rates/dates and validate supported Home type mapping.
- `src/app/layouts/PublicLayout.tsx` — single public header lookup target/label correction; no layout/guard/auth changes.
- `tests/home/landing.browser.mjs`, `tests/home/search.test.mjs` — focused behavioral/visual/query-boundary regressions.
- Task contract and this report. No fixture-server, dependency, global-token, Booking or Admin edits.

## Actual checks

| Check | Fresh result |
| --- | --- |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing chunk>500kB warning remains |
| Unit/contract/lifecycle | **29/29 PASS**, including new Home supported-query/editorial boundary test and unchanged28 Booking/auth/navigation/DTO tests |
| Home browser | **5/5 PASS**: finder/query/guest entry, editorial accuracy/invalid slug, all CTA destinations, bounded API states/retry, keyboard/visual/layout |
| V11/V12/V13 browser regression | **13/13 PASS**, unchanged suites |
| Existing Booking/auth/logout interception browser | **5/5 PASS**, unchanged suite; not live staff verification |
| Total distinct browser tests | **23/23 PASS**, no skips; do not count reruns as extra tests |
| Scope / build isolation | `git diff --check` PASS; baseline hashes preserved as above; no DEV reference/banner/scenario-control markers in production JS/HTML |

Browser command: with bundled `CASMS_PLAYWRIGHT_MODULE`, run `node --test --test-concurrency=1 tests/home/landing.browser.mjs tests/booking/refinement.browser.mjs tests/booking/v12-recovery.browser.mjs tests/booking/v13-scenarios.browser.mjs` against5177. Run `tests/admin/booking-logout.browser.mjs` separately with `CASMS_TEST_URL=http://127.0.0.1:5173`; all its APIs are intercepted. Unit command includes `tests/home/search.test.mjs`, V13's existing28-test file set. No dependencies installed.

Three baseline Home checks failed before implementation (Back selection, editorial link assertion, missing guest header lookup). Later test-harness corrections used keyboard activation for the intentionally offscreen skip link and the actual existing login heading “Chào mừng trở lại”; these were not product defects. Final suites above passed after all source changes.

## Fresh rendered evidence

Before and after: full-page `home-WIDTH.png` + viewport `top-WIDTH.png` for **1024,1280,1440,1920**, height1000. **8 before/after pairs**, plus one after footer viewport. No horizontal overflow at any of the four widths (`scrollWidth == innerWidth`). Finder keyboard outline computed3px navy; Tab/Enter skip link reaches main; labels/hints, one h1, image alt attributes checked. No new motion was introduced. Manual NVDA/JAWS/full WCAG certification not performed.

| Evidence at1440 | Before | After |
| --- | --- | --- |
| Hero/finder | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v14-before/top-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v14-after/top-1440.png) |
| Full Landing | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v14-before/home-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v14-after/home-1440.png) |

Corresponding1280/1920/1024 files sit beside these images. JSON measurements are in each directory; after directory also contains fresh Booking regression screenshots. Inspected rendered before1440 hero, after1440/1920 hero, full1024 layout and1440 footer. Original image assets remain low resolution, most noticeable at1920; no new media or invented cruise photography was introduced.

## Live limitations and remaining prerequisites

Fresh real-browser GET at **2026-10-21 09:47:54 UTC** had no Authorization/Cookie, status502, no trace/correlation headers. UI rendered service-unavailable + Retry with no inventory cards. Evidence: `C:/Users/USER/AppData/Local/Temp/ocv-v14-live/probe.json` and `search-live-1440.png`. Browser blocked non-GET API requests in that check. No Booking mutation or credential test was attempted.

Backend remains unavailable/unstable for successful live inventory/Booking E2E; V13 historical403/startup handoff remains at [OCV_V13_BE_HANDOFF.md](C:/Users/USER/OneDrive/Documents/GitHub/CASMS_Frontend/CASMS_WebApp/OCV_V13_BE_HANDOFF.md). V14 does not claim current BE security/migration policy is fixed. Successful live create, reference lookup, contracts/payments and staff logout remain unverified. Real legal/help pages or verified support contact are not supplied, so no active placeholder policy/support controls are advertised.

**Verdict: Landing UI READY for the verified scope; successful live Booking E2E BLOCKED.**
