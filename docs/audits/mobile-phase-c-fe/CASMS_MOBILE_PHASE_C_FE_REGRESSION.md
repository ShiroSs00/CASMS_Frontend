# CASMS Mobile Phase C — FE_REGRESSION

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc/sửa test theo IMPLEMENTATION. Baseline 130 tests giữ nguyên; các stub cũ được bổ sung DTO mandatory để validation thật có ý nghĩa, không bỏ hoặc skip tests. Test chỉ dùng fixture/stub cục bộ.

Kết quả cuối ngày 25/11/2026:

| Kiểm tra | Kết quả |
|---|---|
| npm run typecheck | PASS, exit 0 |
| npm run lint | PASS, exit 0, không error/warning |
| npm test | **149/149 PASS**, 0 fail/skip/cancel; giữ 130 tests baseline, thêm 19 tests |
| Unit/contract C | PASS: schema, search/filter, exact scope, recovery intent, nullable projection, journal, lifecycle và safe errors |
| Expo export --platform all | **PASS Android/iOS/Web**, lượt cuối exit 0, .expo/phase-c-export |
| Expo install --check online | Báo 11 package nền mismatch, chưa sửa theo scope |
| Expo Doctor | **19/20**, exit 1 ở check version của 11 package nền; không che lỗi bằng exclude |
| git diff --check | PASS, chỉ có cảnh báo line-ending CRLF của Git |
| UI rendered | BLOCKED_BY_ENVIRONMENT / browser access; không có screenshot đủ chứng minh |
| Real Backend QA / Device E2E | NOT RUN; BLOCKED_BY_DATABASE/BACKEND/ENVIRONMENT, thiếu QA được xác nhận |

Fixture cũ được bổ sung currencySnapshot và các field DTO mandatory; nullable/missing theo NON_NULL normalize null, không đổi thành 0. Không đổi assertion nghiệp vụ để che lỗi, không skip/xóa baseline. Journal unit stub chỉ giả SecureStore trong tiến trình test, không thay API production.

 Evidence ignored trong CASMS_MobileApp/.expo/: phase-c-tests.log, phase-c-export-final.log, phase-c-doctor.log; UI attempt logs phase-c-ui-server.log/phase-c-ui-host.log. Log UI không dùng làm evidence tích hợp thật.

Các nhóm test thêm: search/category/empty/inactive; BP isolation cùng booking; resource entitlement exact ID; unknown price/currency/precision; schedule zero/full/bad time/mismatch; projection zero/null quota/blocker; intent same/change; request/registration malformed HTTP200; lifecycle/ended/full; no replay; exact CruiseStop chain/OMITTED/wrong stop; auth/session/API/voyage late guard; NON_NULL omitted fields; raw note không persistence; journal serialized double tap, compare-and-clear và capture URL trước queue.

Expo compatibility online và Doctor vẫn báo 11 package nền, không tự nâng theo guardrail. Doctor 19/20. Npm advisories baseline ghi tại FE_MAINTENANCE_BACKLOG, không audit-fix/force. Không có dependency mới ở C.

Phân loại: **STATIC_VERIFIED / UNIT_TEST_PASSED / CONTRACT_TEST_PASSED / EXPORT_PASSED** theo kết quả cuối đã quan sát. REAL_API/DEVICE_E2E chưa chạy, BLOCKED_BY_DATABASE/BACKEND/ENVIRONMENT/HARDWARE theo scope. UI browser block đã ghi trong UI_UX_REVIEW. Không có bằng chứng thực để đóng M06/M07/M08/M09/M13/M17 hoặc BE-08/09/14.
