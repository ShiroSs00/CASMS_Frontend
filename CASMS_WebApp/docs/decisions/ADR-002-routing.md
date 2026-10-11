# ADR-002 — React Router is the Web routing standard

Status: Accepted

Date: 2026-10-11

Source: [bootstrap plan v1.0](../engineering/bootstrap-plan.md)

## Context

Routing must be real from WEB-001 so future page work extends an established application boundary instead of replacing a placeholder.

## Decision

Use React Router 8 in Data mode. `src/app/router.tsx` creates one browser router outside the React tree, `src/app/providers.tsx` renders its `RouterProvider`, and app layouts host nested route content. `app` imports feature pages only through public entries.

WEB-001 registers only `/` for the technical home shell. It does not invent business routes.

## Consequences

- Future routes are composed centrally in `app/router.tsx` after product/screen scope is confirmed.
- Route components remain owned by their feature modules.
- Static hosts will need SPA fallback configuration in a deployment task; deployment is out of scope for WEB-001.
