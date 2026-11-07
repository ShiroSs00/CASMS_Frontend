# Repository UI/UX instructions

## Scope
- This repository contains Web Admin, Web Booking, and Mobile App.
- The default scope for web UI/UX work is `CASMS_WebAdmin` and `CASMS_WebBooking` only.
- Do not change `CASMS_MobileApp` unless the user explicitly asks.
- Keep Web Admin and Web Booking as distinct experiences. They share a design language, not one identical layout.

## Required design references
Before changing a web interface, read:
1. `design-systems/ocevie/DESIGN.md`
2. `design-systems/ocevie/tokens.css`
3. The existing components and styles used by the target screen.

Use the installed UI/UX skills when relevant. Use OpenDesign's frontend-design guidance for interface design and refinement when available. Use animation-specific guidance only when the task actually requires motion work.

## Component and styling rules
- Reuse and improve existing component surfaces before creating new primitives:
  - Web Admin: `CASMS_WebAdmin/src/shared/ui/AdminUI.tsx` and `src/shared/ui/admin-v3/`.
  - Web Booking: `CASMS_WebBooking/src/shared/ui/Primitives.tsx` and `src/app/layouts/`.
- Both web apps currently contain matching token, overlay, experience, and primitive CSS assets. Keep corresponding shared rules synchronized when a shared rule changes.
- Do not create a third Button/Field/Modal system.
- Do not introduce a new UI library or add dependencies without explicit approval.
- Carbon is the design and behavior reference by default, not permission to replace the current UI implementation wholesale.
- If the user later approves `@carbon/react`, use a supported package version compatible with the repository's React version. Never use deprecated `carbon-components-react`.
- Avoid global CSS overrides that unintentionally affect the other application or the Three.js ship viewer.

## Product and business guardrails
- Treat existing API contracts, route behavior, permissions, domain states, validation, and business copy as authoritative.
- A visual redesign must not change business rules, status meaning, role permissions, booking behavior, pricing, or approval/sale lifecycle.
- Do not invent statuses, defaults, prices, deadlines, fees, or operational rules.
- Preserve established Vietnamese terminology and labels. Do not expose internal implementation codes as customer-facing copy.
- If a UI improvement requires a business decision or changes workflow semantics, stop and request clarification instead of guessing.

## Implementation workflow
1. Identify the exact screen, user role, primary task, and current component path.
2. Inspect existing component reuse and CSS before proposing a replacement.
3. Apply the shared design contract and the correct app-specific experience rules.
4. Make the smallest coherent change set. Avoid unrelated refactors.
5. Keep Web Admin operationally dense and Web Booking customer-oriented.
6. Report exact files/components changed, design decisions needing approval, and known limitations.

## Visual acceptance criteria
- One clearly dominant primary action in each action group.
- Buttons, fields, selects, and search controls follow shared size and state rules.
- Labels remain visible; helper text and validation appear beside the relevant field.
- Tables are scannable; numbers and times align consistently; status is never communicated by color alone.
- Tabs have a consistent selected state and keyboard behavior within each app.
- Dialogs have a clear header, body, and action footer; unsaved changes are protected.
- Loading, empty, error, disabled, hover, focus, and success states are intentional.
- Text does not overlap, truncate unexpectedly, or become unreadable at supported widths.
- Keyboard focus is visible; reduced-motion preferences are respected.
- No decorative card, badge, icon, gradient, or animation is added without a clear information or task purpose.

## Mandatory OceVie standard for every web UI task

OceVie is the required UI/UX standard for every change in Web Admin and Web Booking, including new screens, forms, overlays, tables, lists, navigation, booking flows, redesigns, bug fixes, and component additions. The HTML Component Lab is a visual reference.

Follow this order for every UI change:

1. Read `design-systems/ocevie/DESIGN.md` and `design-systems/ocevie/tokens.css`.
2. Inspect the target screen and applicable shared UI, including the app's primitive and overlay entry points.
3. Identify suitable components to reuse.
4. Identify missing variants and extend the existing component where appropriate. Keep one implementation of each primitive per app.
5. Implement with those components and the mapped OceVie tokens. When a semantic value is missing, add it to the canonical token file and update the app mapping. Avoid isolated colors, font families, radii, spacing, control heights, and shadows.
6. Verify accessibility, keyboard behavior, and responsive layout.
7. Review the result against related screens at supported widths. Preserve the distinct Admin and Booking layouts.
8. Report any deviation or unresolved design decision. If the request conflicts with OceVie, explain the conflict and request approval before establishing a new pattern.

Both app stylesheets import the canonical token stylesheet. Build each app with the repository's `design-systems/ocevie/` directory present.
