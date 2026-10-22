# Supplier UI repair

Baseline: 38b0d4816c350487e64198b336c7c51bcf7f7399. Preserve all earlier session edits.

Allowed: src/features/suppliers/{pages/SupplierListPage.tsx,pages/SupplierDetailPage.tsx,components/SupplierListView.tsx,components/SupplierList.module.css,components/SupplierDetail.tsx,components/SupplierDetail.module.css}, this contract. Align supplier header/filter/list with shared UI, fix reset alignment, stretched badges and dense contact cells, retain filtering and existing lifecycle/verification actions. Remove supplier validity-check button and unused UI handler/prop. Do not change backend, dependencies or other modules. User's no-testing request remains active: no tests, lint, typecheck, build or browser checks.

Implemented shared PageHeader, filter panel/ListFilters, DataTable, compact Badge and ListFooter. Contact fields split into readable lines, names link to detail, empty/error/loading states are distinct. Removed validity-check control, handler, prop and its styles; verification/status controls retained. Source reviewed only; no automated or browser checks run.
