# Merge service navigation

User requests services, products and packages in one menu group. Combine the existing services/products/requests and packages/assignments sidebar groups into one group named "Dịch vụ, sản phẩm và gói". Keep existing child routes and permission filtering. No backend or database changes.

Base commit: ee89e6cfb53876951070c386a59d0333faf94aae. Baseline git status inspected; existing untracked documentation remains untouched. Allowed paths: this contract and src/shared/ui/admin-v3/admin-navigation.ts.

Acceptance: services, products, packages, service requests and package assignments share one sidebar disclosure; authorized children only; the group opens on any active child. Preserve role-specific ordering and all other groups. User's no-test instruction remains in effect. Verify by source diff review only.
