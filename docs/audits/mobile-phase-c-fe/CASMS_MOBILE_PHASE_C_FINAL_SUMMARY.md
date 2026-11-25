# CASMS Mobile Phase C — FINAL_SUMMARY

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

Đã triển khai C trên working tree B: service hub/detail/schedule/request/recovery, my requests theo đúng BP, activities/excursions theo cruise/stop, purchased entitlement đọc thuần và quota server. Tách giá niêm yết/usage/quota, không thêm Folio/Spending/SSE/attendance/Staff workflow hoặc mua gói.

Module sẵn sàng source: global catalogue/detail và schedule; service request CRUD/recovery; standard activity/excursion registration lifecycle; purchased Fare entitlement projection. Module/phần còn BLOCKED: ship-specific availability/location projection, legacy remaining quota/usage rows, canonical fare charge/overlap/recovery policy và package write decision. BE-15/16/17 và DB-04/06 bổ sung, giữ các finding cũ.

Acceptance tổng: **FE_READY_WITH_EXTERNAL_BLOCKERS**. TypeScript/lint, 149/149 tests, export Android/iOS/Web và git diff --check pass. Expo Doctor 19/20; 11 package nền giữ nguyên; không FULL_INTEGRATION_PASS. UI rendered và Real API/device chưa nghiệm thu. Chưa đủ điều kiện đóng gate end-to-end để chuyển sang nghiệm thu Phase D. Có thể chuẩn bị phần D độc lập trên contract đã xác minh khi được yêu cầu, không triển khai D trong tác vụ này.

File list: FE_IMPLEMENTATION. Test evidence: FE_REGRESSION. Skill usage: đủ 7 bắt buộc. Handoff: hai file hiện có trong mobile-phase-a0-fe; dependency backlog FE riêng. Không commit/push.
