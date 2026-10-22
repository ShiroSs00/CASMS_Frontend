# Development

Use Node 24 and npm 11 as specified by package.json. Run `npm ci` when dependencies are not installed, then `npm run dev`. Vite proxies `/api` to `http://127.0.0.1:8080` by default. Set `CASMS_API_PROXY_TARGET` in a local environment file to change the development backend origin, then restart Vite. `VITE_API_BASE_URL` controls the browser API base; VITE variables are public.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`. The normal test command never enables live database mutations. Browser fixture scripts (`*.browser.mjs`) are separate and must not be reported as covered by the unit command.

For the existing isolated local QA database, run `powershell -File tests/integration/start-backend-qa.ps1`. It reads the existing ignored QA runtime shared with mobile, verifies database name `casms_mobile_qa`, and starts BE on 8080 with Flyway disabled and schema update confined to that QA database. It does not repair migrations or change backend source. Java 21+, Maven and PostgreSQL 16 are required.

To run the live test, set `CASMS_LIVE_QA=casms_mobile_qa`, `CASMS_LIVE_API_URL=http://127.0.0.1:5175/api` (or your Vite port), and the seeded `CASMS_QA_USERNAME`/`CASMS_QA_PASSWORD`, then `npm run test:live`. This reads public resources, signs in, creates one draft booking and cancels it. Never use a production account/database. Credentials must stay out of Git and logs.

Known normal-database blocker observed on 2026-10-22: V4__add_activity_supplier_tour_permissions.sql fails the RolePermissionMapping_permission_check constraint. This requires a separate backend migration repair. QA startup is not evidence that normal migrations pass.

Production hosting needs a real same-origin API proxy or a deployed HTTPS `VITE_API_BASE_URL`; Vite's development proxy is not part of the production bundle. The checked-in Vercel rewrite only provides SPA routing.
