# WebApp UI/API repair — 2026-10-22

User scope: repair issues identified in the WebApp audit, replace the home hero with a slideshow of real Asian international ports, and start the local backend to verify API connectivity.

Baseline: FE `5ff285a`, clean working tree. BE `d4bd597` with pre-existing changes in two tracked target/maven-status files and untracked run-backend.bat.

Allowed paths: CASMS_WebApp/src/**, tests/**, public/**, docs/**, README.md, .gitignore, vite.config.ts, .env.example, package.json (scripts only), vercel.json. Local ignored QA logs/artifacts are permitted. Do not change dependencies/lockfile, mobile, or backend sources. Do not push to BE. No push requested for this repair.

Acceptance: guest public ship/itinerary APIs are used correctly; package benefits are shown; cross-currency package selection is blocked without a verified conversion policy; API proxy can target a configured local BE; route bundles are split; stale tests are repaired without removing behavioral coverage; slideshow supports keyboard, pause, reduced motion and mobile sizing; images have source/author/license credits; lint, typecheck, build and relevant tests pass. Verify live reads/auth against BE and report any independently blocked database/startup issues accurately.
