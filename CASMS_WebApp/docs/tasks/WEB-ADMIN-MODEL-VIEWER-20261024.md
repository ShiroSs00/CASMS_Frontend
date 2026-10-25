# Admin 3D model viewer

User authorizes a complete read-only 3D model/detail experience in Admin, with real BE/FE running for review. Baseline e49cce5 on main; unrelated untracked operations task notes are pre-existing. BE a861f60 has existing local edits: preserve them. No commit/push requested for this task.

Allowed: src/features/ship-model-viewer/**, src/features/ship-model-import/ShipImportPage.tsx (viewer link only), src/app/router.tsx, src/shared/ui/admin-v3/admin-navigation.ts, src/shared/api/client.ts and index.ts (authenticated binary/JSON asset transport), package.json/package-lock.json (Three.js and type definitions), tests/ship-model-viewer/**, this contract. No backend source, mobile or model asset edits. Start existing local BE/FE; existing Flyway V27 may apply on normal dev startup. Do not upload, register, activate or edit real models for verification.

Navigation scope also includes src/shared/ui/admin-v3/AdminShell.tsx solely to render Model 3D as a direct menu entry consistent with existing Admin tools.

Scope: Admin-only menu and versioned deep links, ship/version selection, real GLB rendering with orbit/zoom/pan, camera presets/reset/fullscreen, deck isolation and cabin pick/highlight, structure search, object details, model provenance, version/status and import history/issues. Read draft assets without activating a model. Preserve coordinate system/node identity. Partial asset failure, no model, 403, stale requests, progress and GPU/CPU cleanup must be handled. Load assets on demand and never send auth to external URLs. Reuse effective permissions; no new grants needed.

Validation: lint/typecheck/build; focused API/selection/URL safety tests; browser real authenticated Admin desktop/mobile. Verify no cross-ship/version stale data. Keep servers running and open a deliverable preview tab.

## Delivered

- Admin-only /admin/ship-models and a versioned link from import results. No backend source or permission changes.
- Three.js 0.186.1 GLTFLoader/OrbitControls render actual protected GLBs; same API credentials used in memory, external/traversal asset references rejected. Progress updates throttled; obsolete reads aborted; scene geometries/materials/textures, GPU context, controls and resize observers disposed.
- Ship/version selector, read-only draft viewing, exterior/full-structure modes, all passenger/service decks, cabin search/picking/highlight, camera presets/reset/zoom, wireframe/fullscreen. Detail inspector shows source dimensions/position/type/capacity and provenance; metadata/history/issues tabs use backend reads independently.
- BE started on 8080 (session 17096) using existing local environment; normal startup applied Flyway V27 successfully. FE 5176 restarted with localhost connectivity (session 38291) after initial restricted proxy failed; Admin login and real model reads verified. No model upload/register/activate/edit performed for this task. Preserve existing backend modifications and unrelated operations task document.

## Verification

- Final npm run lint, npm run typecheck, npm run build and git diff --check passed. 14 viewer/import tests passed, including binary auth/401/403, abort handling, safe asset paths, real id/revision DTO contract, pagination and Admin route policy.
- Real Conquest v10: exterior, Riviera GLB, 13 passenger decks + 2 service decks, 305 cabins, 305/305 cabin mappings; history 13 decks/305 cabins imported by admin. Selected C01-001 from list, focused/highlighted in 3D, then canvas raycast changed selection to C01-010 and updated inspector. Top view and fullscreen visually verified. Metadata and history verified. Ocean Voyager empty-model state removed previous canvas (count=0), returning to Conquest works.
- Desktop 1600x1000 and mobile 390x844 checked; document width 375px within 390px, mobile deck switcher visible and canvas width341px. Viewport overrides reset. Screenshot admin-threejs-model-viewer.png is real authenticated UI evidence. Browser tab retained for review; BE/FE left running.
- Build has a size warning for the route-lazy Three.js viewer chunk (~657kB,167kB gzip). Existing dev-only zod 4.6.5 audit warning was present in baseline package-lock; no Three.js advisory reported. No broad dependency updates made.
- Full GLB loads only on explicit “Toàn bộ cấu trúc”; exterior and individual deck GLBs were tested against real storage. No claim of testing the entire large full-structure GLB or every asset in all versions. No full repository test-suite passing claim.
