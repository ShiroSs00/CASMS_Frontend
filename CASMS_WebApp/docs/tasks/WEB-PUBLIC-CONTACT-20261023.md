# Public booking contact and management login

User request: replace public passenger sign-in with Contact; reserve web sign-in for managers and admins.

Baseline: `38b0d4816c350487e64198b336c7c51bcf7f7399`. Existing untracked documentation is pre-existing and must be preserved.

Allowed paths: `src/app/**`, `src/features/auth/**`, `src/features/booking/**`, related `tests/**`, this contract. No backend, dependency or mobile changes.

Acceptance: public navigation offers Contact instead of a passenger account menu; guest booking and reference lookup remain available; former customer account routes lead to reference lookup; login accepts ADMIN and current manager roles and opens the appropriate management workspace; passenger sessions cannot be restored. Provide a distinct management login entry in the footer. Run lint, typecheck, build and unit tests; inspect desktop and mobile behavior.

User clarification: Contact shows a panel on hover with phone and Gmail. Also support focus, touch and Escape dismissal. The user requested lucky sample contact details; display `09xx 686 888` and `ocevie.lucky88@gmail.com` as explicitly unactivated samples without outbound links until ownership is verified.

Delivered: public header contact panel, separate footer management sign-in, manager/admin-only browser sessions (login/restore/refresh), management-only return navigation, legacy customer pages redirect to guest lookup, public API error contact links. Backend authentication policy is unchanged.

Verification: lint, TypeScript and production build passed. Full unit suite: 345 passed, 1 skipped; an additional regression covering every manager/admin landing route passed afterward. Browser fixture check passed at 1440, 768 and 390px for hover, panel traversal, Escape, click/outside dismissal, guest lookup routing, passenger login rejection and no horizontal overflow. Desktop and mobile screenshots visually inspected. Initial sandbox unit run failed on subprocess restrictions; rerun outside sandbox passed. No live account login or booking mutation performed; existing untracked documentation preserved.
