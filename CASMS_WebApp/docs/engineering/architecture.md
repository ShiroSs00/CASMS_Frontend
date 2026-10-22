# Architecture

Layers: `app → features → domain → shared`. The app composes routes and feature public exports. Features may use their own internals, domain public entries and shared utilities; features must not import other features or app internals. Domain cannot depend on features or app. Shared cannot depend on app, features or domain.

Module public entries are `index.ts`/`index.tsx`, enforced by the `architecture/boundaries` ESLint rule in eslint.config.js. Cross-feature composition belongs in app. Route lazy imports use these same public entries. Booking session state stays mounted across booking steps and is retired on logout/account change.

API transport is `src/shared/api/client.ts`: envelopes and raw responses have distinct decoders, tokens are supplied by auth, and request cancellation/timeouts propagate. Each feature owns DTO validation and its lifecycle checks. Backend permissions remain authoritative; public read APIs must not be hidden behind unrelated staff permissions in the UI.

Use CSS Modules for local styles and existing shared UI primitives for form fields, notices and modal behavior. Respect reduced motion and keyboard navigation.
