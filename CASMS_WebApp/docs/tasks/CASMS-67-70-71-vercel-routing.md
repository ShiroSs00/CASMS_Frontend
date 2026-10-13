# CASMS-67 / CASMS-70 / CASMS-71 — Vercel routing

Status: IMPLEMENTED — production deployment and backend URL pending (2026-10-13)
Base commit: 0355c46; baseline working tree clean.
Authorization: user requested Vercel setup and push on the current feature branch.

## Scope

Add CASMS_WebApp/vercel.json and this new task document only.
Configure the existing Vite build and SPA fallback so direct admin links and
refreshes load index.html. Preserve existing source code and documentation.
Source: https://vercel.com/docs/frameworks/frontend/vite

## Deployment requirements

Vercel Root Directory must be CASMS_WebApp. Production tracks main; pushing
the feature branch does not update production until the change is merged.
The public backend URL is not provided. Set VITE_API_BASE_URL to its HTTPS
base URL including /api in Vercel, allow the frontend origin in backend CORS,
then redeploy. The local Vite proxy does not run on Vercel.

## Validation

Run lint, typecheck, build, JSON validation and staged diff review.
Check merge compatibility with current origin/main before pushing.
Live Vercel routing and backend access require a new deployment and are not
confirmed by a local build.

## Completion evidence

- Added Vite build settings and SPA rewrite in vercel.json.
- JSON parsing, lint, typecheck and production build: PASS.
- Only the two allowed new files changed; no dependency or application changes.
- Vercel dashboard settings and live deployment have not been changed or verified.
