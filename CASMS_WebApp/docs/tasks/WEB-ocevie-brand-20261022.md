# OceVie brand alignment

User request: apply the supplied OceVie Complete Logo Kit and OceVie Web Design Guidelines v1.0 to the existing WebApp, and unify its displayed name as OceVie.

Base: 5ff285a. The UI/API repairs from the preceding turn are pre-existing uncommitted work; preserve them. Baseline includes their modified files, public port images, docs and tests. No backend or mobile source changes. No commit/push requested.

Allowed: WebApp src/**, public/**, index.html, branding documentation and tests affected by UI names/semantics. Use original SVG assets without redrawing, stretching, tinting or rotating them. Self-host the specified licensed fonts. Apply shared brand/semantic tokens to public, booking, auth and admin UI; preserve actual API records and internal session storage compatibility. Treat the attached documents as visual reference, not authorization to implement speculative routes, payments or backend changes.

Verify: no stale public OcvViet/AURORA branding; correct light/dark logos, palette, type, readable controls/statuses; public/admin responsive checks at 390/768/1280/1440; lint, typecheck, build, unit tests and existing live API smoke test.
