# Development

Status: CONFIRMED

Last verified: 2026-10-11

## Runtime

- Recommended Node.js: `24.21.0` LTS, pinned in `.nvmrc`.
- npm: `11.19.0`, pinned in `packageManager`.
- `package.json` engines restrict Node to supported major 24 and npm to major 11.

Node 24.21.0 was the [latest Node LTS](https://nodejs.org/en/download/archive/v24) at implementation time. Vite 8 requires Node `^20.19.0 || >=22.12.0`; React Router 8.4 requires Node `>=22.22.0`. Node 24.21.0 satisfies both without choosing an EOL/current-only runtime.

## Install and scripts

From `CASMS_WebApp/`:

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
npm run preview
```

`npm install` is reserved for intentionally changing dependencies and regenerating `package-lock.json`. Clone/CI validation uses `npm ci`.

| Script | Behavior |
| --- | --- |
| `dev` | Start the Vite development server |
| `lint` | Run ESLint, React hooks/refresh rules, and architecture boundaries with zero warnings allowed |
| `typecheck` | Check both TypeScript projects with `tsc -b` |
| `build` | Typecheck and create the production Vite bundle |
| `preview` | Serve the existing production bundle locally |

There is no `test` script until a feature task introduces a real test harness and meaningful tests.

## Resolved direct dependencies

Versions below are resolved by `package-lock.json` on 2026-10-11:

| Runtime | Version | Tooling | Version |
| --- | ---: | --- | ---: |
| React | 19.3.0 | TypeScript | 6.0.3 |
| React DOM | 19.3.0 | Vite | 8.3.4 |
| React Router | 8.4.0 | ESLint | 10.12.0 |
|  |  | typescript-eslint | 8.71.1 |
|  |  | @vitejs/plugin-react | 6.1.2 |

See `package.json` and `package-lock.json` for every direct/transitive package and integrity hash.

## Environment variables

`.env` and `.env.*` are ignored except `.env.example`. Any future `VITE_*` variable is shipped to the browser and must never hold a secret.
