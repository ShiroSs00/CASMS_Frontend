# Testing and validation

Status: CONFIRMED

Source: WEB-001 contract and scripts currently present in `package.json`.

## Required checks

| Change | Required validation |
| --- | --- |
| TypeScript, route, component, style or config | `npm run lint`, `npm run typecheck`, `npm run build` |
| Dependency/lockfile | clean `npm ci`, then lint/typecheck/build |
| Module/layer rule | expected-failure fixture for alias and relative paths, fixture removal, clean lint |
| Responsive shell/UI | Browser check at 375 px and 1440 px, horizontal overflow, focus/navigation, console errors |
| Documentation | Validate relative links and source statuses |

## Boundary proof procedure

For WEB-001, temporary TypeScript fixtures must cover both alias and relative forms for:

- feature → another feature;
- domain → feature/app;
- shared → domain/feature/app;
- app/other module → deep feature implementation.

Each fixture must make ESLint fail with the expected `architecture/boundaries` message. Remove all fixtures afterward and rerun `npm run lint` cleanly. Do not keep invalid examples in source.

## Test harness

No Vitest, Testing Library or Playwright harness exists yet, and there is intentionally no placeholder `test` script. The first feature requiring automated behavior tests must add an appropriate harness, script and acceptance criteria in its own scoped task.
