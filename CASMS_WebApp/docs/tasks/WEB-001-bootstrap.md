# WEB-001 — Bootstrap React + Vite + TypeScript

Status: DONE
Base commit: `1488cfd2c9416078b1ac77f948baba80fb0cf084`
App root: `CASMS_WebApp`

## Baseline worktree

Captured before edits: yes

Pre-existing modified/untracked/deleted/renamed paths:

- none (`git status --short` returned no entries)

All pre-existing paths must remain untouched. The seed document was then added at its canonical path before implementation began.

## Outcome

Provide an independently installable and buildable React, Vite, and TypeScript web shell under `CASMS_WebApp/`, with real home routing, canonical documentation, and lint-enforced module boundaries.

## Authoritative inputs

- `docs/engineering/bootstrap-plan.md`, version 1.0 dated 2026-10-11.
- Node.js and Vite official release/runtime documentation checked on 2026-10-11.
- Product rules, Figma mappings, and backend contracts are missing and remain `UNCONFIRMED`; no dependent behavior may be invented in this task.

## Allowed changes

- Add, edit, rename, or delete files only under `CASMS_WebApp/**`.
- Delete `CASMS_WebApp/webapp.txt` after confirming it is empty.
- Add the Web package, lockfile, configuration, shell source, styles, documentation, and `AGENTS.md`.

## Read-only dependencies

- Repository root Git metadata and root `README.md`.
- `CASMS_MobileApp/**`.

## Out of scope

- CASMS business features, business rules, backend endpoints, auth, booking, payment, search, or inferred Figma behavior.
- Root workspace tooling, deployment, CI, and changes outside `CASMS_WebApp/`.
- Test frameworks or a placeholder `test` script.

## Acceptance criteria

- [x] Node LTS patch, npm version, dependency versions, install commands, and scripts are documented.
- [x] `npm ci`, `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- [x] Development and preview servers serve the routed shell without runtime/import errors.
- [x] The shell has no horizontal overflow at 375 px or 1440 px; available navigation/focus behavior works.
- [x] Alias `@/` resolves in TypeScript and Vite.
- [x] Temporary fixtures prove feature→feature, domain→feature/app, shared→domain/feature/app, and deep external module imports are rejected for alias and relative paths where applicable; fixtures are removed afterward.
- [x] React Router is the Web routing standard and the home shell is rendered through a real router.
- [x] Documentation distinguishes `CONFIRMED`, `PROPOSED`, and `UNCONFIRMED`, and internal links resolve.
- [x] `package-lock.json` exists; `node_modules`, `dist`, and real env files are not tracked.
- [x] Final diff contains no changes outside `CASMS_WebApp/` and preserves the empty baseline.

## Validation

Run from `CASMS_WebApp/`:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Start `npm run dev` and `npm run preview`, then inspect browser/runtime output and the 375 px and 1440 px viewports.
- Add temporary boundary fixtures, run lint expecting rejection for every required group and path form, then delete all fixtures and rerun lint cleanly.
- Validate every relative Markdown link under `docs/`.
- Compare final `git status --short` and diff paths with the baseline and allowed paths.

## Scope expansion

If a required change falls outside `CASMS_WebApp/**`, report its path, reason, and impact. Do not make the change without explicit scope expansion.

## Completion evidence

- Baseline worktree rechecked: yes. Base commit remains `1488cfd2c9416078b1ac77f948baba80fb0cf084`; the captured baseline had no entries.
- Files added/edited/deleted/renamed by this task: added Web-only package/config/lock files, `AGENTS.md`, canonical docs, routed shell/home source and styles under `CASMS_WebApp/**`; deleted the confirmed-empty `CASMS_WebApp/webapp.txt`; no rename.
- Git delivery policy: `docs/engineering/git-workflow.md` was added from the user-provided v1.0 policy, linked from the docs index/README, and its required Git/Push rules were added to `AGENTS.md` before commit.
- `npm ci` with Node `24.21.0` and npm `11.19.0`: pass, 163 packages installed, 0 vulnerabilities.
- `npm run lint`: pass after fixture removal, 0 warnings/errors.
- `npm run typecheck`: pass.
- `npm run build`: pass with Vite 8.3.4, 107 modules transformed.
- Boundary expected-failure proof: pass. Four temporary fixture files produced 9 `architecture/boundaries` errors: feature→feature (alias + relative), domain→feature/app (alias + relative), shared→domain/feature/app (alias + relative represented), and deep external import (alias + relative). Fixtures were deleted; final fixture count is 0.
- Development server: pass at `http://127.0.0.1:4173/`; routed home rendered and browser console had no warning/error.
- Production preview: pass at `http://127.0.0.1:4174/`; routed home rendered and browser console had no warning/error.
- Responsive/accessibility browser check: pass at 375 px and 1440 px with no horizontal overflow. At 1440 px the hero grid resolved to two columns. Tab focused the visible skip link first; Enter navigated to `#main-content` and focused `<main>`; the brand link returned to `/`.
- Documentation link check: pass, 18 Markdown files and 25 relative links checked, 0 broken.
- Final scope audit: pass, 0 status entries outside `CASMS_WebApp/`, no Mobile diff, `package-lock.json` present, `.env.example` trackable, `node_modules` and `dist` ignored.
- Acceptance criteria not met: none.
- Remaining risk/source gap: product scope, business rules, glossary, Figma/screen mappings and API contract remain `UNCONFIRMED`; WEB-001 intentionally implements no dependent business behavior.
