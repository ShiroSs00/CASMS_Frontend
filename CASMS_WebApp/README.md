# CASMS WebApp

React + Vite + TypeScript application for OcvViet public cruise discovery, booking and operational administration.

## Run

Use Node 24 and npm 11 (see package.json). Install with `npm ci`, then `npm run dev`.

- Browser API base: `VITE_API_BASE_URL=/api`.
- Local backend origin: `CASMS_API_PROXY_TARGET=http://127.0.0.1:8080`.
- Backend must be running; the dev proxy forwards requests and does not supply mock inventory.
- For the existing isolated PostgreSQL QA runtime: `powershell -File tests/integration/start-backend-qa.ps1`.

## Validate

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

Live API checks require explicit QA environment variables (see tests/integration/webapp-live-api.test.mjs). Production hosting requires an API proxy or a deployed backend URL; the SPA rewrite is not an API server.

## Current behavior

Public catalog and details, available cabins, package details/benefits, booking create/lookup and account booking operations use backend APIs. Admin modules are loaded on demand. Unsupported online payment, document upload, check-in and boarding capabilities remain unavailable; no fake payment or boarding success is generated.

The home slideshow uses licensed photos of Marina Bay (Singapore), Victoria Harbour (Hong Kong), and Ōsanbashi (Yokohama). Credits are served at [public/images/ports/credits.html](public/images/ports/credits.html). Images are editorial inspiration, not live inventory.
