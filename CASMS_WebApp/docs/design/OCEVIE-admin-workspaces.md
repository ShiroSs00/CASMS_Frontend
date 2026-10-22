# OceVie admin roles and workspaces

Current contract: CASMS Backend `15a113ac3b8917d8150d69225a3b785f49a60b0e` (2026-10-22). This replaces the earlier local-only shore/onboard role split.

| Login role | Landing |
| --- | --- |
| ADMIN | /admin/system — identity administration; no implicit business or finance authority |
| CRUISE_MANAGER | /admin/workspaces/schedule |
| OPERATIONS_MANAGER / SHIP_MANAGER | /admin/workspaces/operations |
| ACTIVITY_SERVICE_MANAGER | /admin/workspaces/services — activities, onboard services/products/packages, shore excursions, suppliers and tour groups |
| ONBOARD_STAFF | /admin/service-requests — fulfilment, activity/tour attendance and authorized reference reads |
| BOOKING_AGENT / CUSTOMER_SERVICE | /admin/bookings |
| FINANCE_OFFICER | /admin/staff/finance — existing booking and installment views |
| CHECKIN_STAFF | /admin/staff/checkin — existing guidance screen |
| PASSENGER | /my-bookings; no admin entry |

The new BE enum has 11 roles. SHORE_MANAGER and ACTIVITY_MANAGER are no longer accepted login/session roles. Backend migration V17 converts both to ACTIVITY_SERVICE_MANAGER. The WebApp does not modify accounts or run migrations. Old browser sessions carrying retired roles must sign in again after backend migration.

Role identity determines the initial workspace. Navigation and direct resource routes use `/auth/me.effectivePermissions`, including authorized cross-module reference reads. A multi-role account retains the combined grants; primary-role priority selects its initial home only. Each workspace home is restricted to its assigned role(s), and unavailable resource links are hidden. The pre-session policy snapshot in admin-navigation.ts mirrors BE 15a113a solely to choose a valid login returnTo; it never substitutes for runtime session access.

AdminGuard waits for permissions for every protected resource, checks the permission response belongs to the signed-in user, and checks create/edit URLs separately from read routes. Only an already-admitted identical account/roles/path may remain mounted during token refresh; mutations use fresh access.has(). Role changes, account changes, route changes and confirmed revocation retire admission. Failed access never mounts a business feature. No ADMIN bypass exists.

Booking confirmation requires BOOKING_CONFIRM; BOOKING_CREATE and BOOKING_UPDATE cannot confirm. Cancellation uses BOOKING_CANCEL. Cabin changes match BOOKING_CABIN_ASSIGN or BOOKING_UPDATE. Staff booking lists show creation only with BOOKING_CREATE. Service request updates allow SERVICE_REQUEST_CREATE or SERVICE_REQUEST_EXECUTE, while creating a request requires SERVICE_REQUEST_CREATE, matching the BE controller.

Design retains OceVie brand assets and responsive navigation. The unified activity/service workspace includes both shore and onboard tools. Other permitted tools remain visible as work/reference links without changing the user's workspace identity.

Related sidebar links use native details/summary disclosure groups: activities/tours, services/products/requests, packages/assignments, destinations/ports/suppliers, fleet/decks/cabins, cruises/itineraries, bookings/check-in and operational issues/regulations. System and finance remain direct links. Groups are built after permission filtering; empty groups disappear. The current resource group opens automatically, selected child uses aria-current, and users can expand/collapse using pointer, Enter or Space. Narrow-screen outer navigation still closes after navigation.

All 10 staff roles use the same grouped-menu renderer, with role-specific ordering: fleet for SHIP_MANAGER; issues/regulations for OPERATIONS_MANAGER; cruises/itineraries for CRUISE_MANAGER; activity/service tools for ACTIVITY_SERVICE_MANAGER; fulfilment for ONBOARD_STAFF; bookings for BOOKING_AGENT/CUSTOMER_SERVICE; check-in for CHECKIN_STAFF; finance for FINANCE_OFFICER. SHIP_MANAGER is labelled Quản lý đội tàu, gets SHIP_CREATE as its primary workspace action and only sees authorized workspace cards. PASSENGER gets no staff menu.

ActivityController parity: reading shared registrations requires ACTIVITY_ATTENDANCE or ACTIVITY_REGISTRATION. Creating an excursion registration uses EXCURSION_BOOKING, but changing/confirming/cancelling an existing registration uses ACTIVITY_REGISTRATION even for excursions in this BE revision. Participation endpoints use ACTIVITY_ATTENDANCE. The WebApp follows these actual guards and does not query inaccessible registration/participation resources or show creation inputs to attendance-only staff. Package assignment reads also allow BOOKING_READ; only TOUR_PACKAGE_ASSIGN permits their mutation. Public package catalog reference links can be viewed by booking readers, without management authority.

Validation uses unit tests and an isolated UI fixture server whose permission responses are extracted from the BE source. No local QA database, production database, real accounts, migrations or BE runtime are used by this task. This verifies FE access behavior, not deployed migration health or end-to-end payment/check-in workflows. New BE payment, guidance-session, staff-assignment and 3D capabilities need their own feature integrations; existing guidance/finance screens are not represented as complete integrations.
