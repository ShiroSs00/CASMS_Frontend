# ADR-001 — Feature-module architecture

Status: Accepted

Date: 2026-10-11

Source: [bootstrap plan v1.0](../engineering/bootstrap-plan.md)

## Context

CASMS Web needs predictable ownership for UI, state, API adapters and styles without the operational overhead of microfrontends or a package-per-feature monorepo.

## Decision

Use one React/Vite application organized as `app`, feature modules, shared domain modules, and business-independent shared code. Pages compose focused components. Cross-module feature imports are prohibited, and feature/domain consumers use public entries.

## Consequences

- A change can be scoped to a feature and its explicit dependencies.
- Shared code requires evidence of reuse or business independence.
- ESLint rejects invalid layer direction and deep imports.
- New modules are created only when an approved task needs them; WEB-001 creates only `home`.
