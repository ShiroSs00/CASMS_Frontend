# CASMS Mobile Phase C — FE_IMPLEMENTATION

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File sửa trong CASMS_MobileApp:

- `src/features/passenger-actions/PassengerServiceRequestsScreen.tsx`: hub, category/search, chi tiết, slot, scope và recovery.
- `src/features/passenger-actions/PassengerActivitiesScreen.tsx`: scope, lịch/địa điểm, quyền lợi, registration lifecycle/reconcile.
- `src/features/passenger-actions/PassengerPackagesScreen.tsx`: đọc quyền lợi đã mua, bỏ action đổi gói draft khỏi màn Mobile.
- `src/features/passenger-actions/passenger-api.ts`, `passenger-types.ts`: API/schema và context metadata.
- `src/features/passenger-actions/service-operation-store.ts`: payload identity, schema, capture API URL trước queue.
- `src/features/passenger-actions/PassengerBookingScreens.tsx`, `src/features/auth/PassengerAccountScreen.tsx`: entry point đọc quyền lợi, bỏ CTA chỉnh gói draft.
- Thêm `src/features/passenger-actions/onboard-contracts.ts`, `onboard-context.ts`, `onboard-errors.ts`, `ServiceDetail.tsx`, `EntitlementSummary.tsx`.
- Thêm `tests/onboard-services.test.mjs`, `tests/service-journal.test.mjs`.
- `tests/passenger-actions.test.mjs`, `tests/service-request-merge.test.mjs`: giữ test cũ và bổ sung field DTO thật cho stub cũ vốn chỉ có ID.
- `tests/fixtures/passenger-api-server.mjs`: fixture in-memory riêng cho UI, không deploy/chạy với DB; thêm đúng shape contract C.

Tài liệu: 11 báo cáo trong thư mục này, FE maintenance backlog riêng; cập nhật hai handoff hiện có trong mobile-phase-a0-fe. File B QR/NFC/POS/config/package vẫn giữ thay đổi từ B, không triển khai lại trong C.

Root cause trước/sau: catalogue thiếu detail/category theo DTO mới; requests lọc theo booking thay vì BP; registrations hiện mọi BP của account; form sống qua đổi voyage; package UI tập trung chỉnh draft. Nay hub/detail/read entitlement hoạt động theo selected voyage và schema, actions kiểm lại source và response trước hiển thị thành công. POST giữ khóa và không retry tự động. Query invalidation của usePassengerAction tái sử dụng toàn bộ prefix Passenger để cập nhật request/catalog/availability/entitlement sau outcome; pull-to-refresh thay SSE.

Bảo vệ context bằng route workspace key và useOnboardGuard kiểm mount/API/account/epoch/booking/BP trước ghi và sau await. Journal serialize writes, capture URL trước queue, không lưu raw note; vân tay nội dung chỉ chống đổi draft vô ý, BE SHA-256 quyết định idempotency. Legacy journal B không payload vẫn giữ để GET recovery, không xóa key chưa rõ kết quả.

Dependency mới: không. Runtime UI chưa xác minh vì IAB timeout localhost và Brave chưa được cấp quyền cho Computer Use. Không bypass hoặc sửa network/security setting. QA/fixture/thiết bị thật chưa được BE/DB xác nhận; tiếp tục source/unit/export độc lập. Acceptance: FE_READY_WITH_EXTERNAL_BLOCKERS; TypeScript/lint/149 tests và export ba nền tảng pass; không FULL_INTEGRATION_PASS.
