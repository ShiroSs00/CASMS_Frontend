# Booking Agent web sign-in

User explicitly requests allowing Booking Agent to enter WebApp after login is rejected by the manager-only FE policy. Baseline `0b1645b` on `codex/complete-journey-workflows-20261023`; all existing modified/untracked work is pre-existing and preserved.

Allowed paths: features/auth/model/{auth-types,auth-session}.ts; features/auth/components/LoginForm.tsx; features/auth/pages/LoginPage.tsx; tests/booking/{management-login.test.mjs,public-contact.browser.mjs}; this document. No BE/database/role grants, other staff admission, Mobile changes or push.

Add BOOKING_AGENT to coarse sign-in eligibility while retaining current role/permission guards and the existing /admin/bookings landing. Update login copy and regression coverage for sign-in, stored session restoration and role landing; passenger-only accounts remain rejected. Validate relevant tests, lint, typecheck, build and actual test_booking_agent web login.

Result: BOOKING_AGENT now passes canSignIn; other admission rules remain unchanged. Updated login copy to mention booking staff. Five management-login regression cases passed, including exact admission roles, passenger rejection/token clearing, Booking Agent session persistence/restoration and existing role-based landing. ESLint, TypeScript, production build and git diff --check passed. Actual browser sign-in with test_booking_agent succeeded via live BE and reached /admin/bookings showing Quản lý đặt chỗ, Tra cứu bằng mã and Tạo đặt chỗ. Left that session open for the user to test. No BE/database grants changed, no commit/push.
