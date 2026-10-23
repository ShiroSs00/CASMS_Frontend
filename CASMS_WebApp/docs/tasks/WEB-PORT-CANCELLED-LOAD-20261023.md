# Suppress cancelled port form loads

User requests removal of the notice showing "Chưa thể lưu / signal is aborted without reason". Source confirms the port edit form reports cancelled effect requests while destination edit already ignores cancellation. Apply the same cancellation guards to both kinds; do not remove real validation or save failures.

Base commit: ee89e6cfb53876951070c386a59d0333faf94aae. Preserve existing menu and port action changes plus all untracked documents. Allowed paths: this document and src/features/itineraries/pages/MasterDataPages.tsx. No backend changes, tests, lint, typecheck or build. Source review only, per user's preference.

Acceptance: cancelled loads cannot update draft, error or loading state. A new edit load clears stale errors and resets its loading state. Existing user-facing validation remains.
