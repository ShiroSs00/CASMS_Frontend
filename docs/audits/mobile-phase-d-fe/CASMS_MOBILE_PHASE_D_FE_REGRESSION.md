# CASMS Mobile Phase D — FE_REGRESSION

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Baseline 149 tests của C giữ toàn bộ assertions. D thêm 15 thành 164/164; fixture Sale cũ bổ sung serviceRequestId/chargeId/unitPrice theo DTO thật, không nới schema để pass.

| Kiểm tra | Kết quả / giới hạn |
|---|---|
| npm run typecheck | PASS, tsc --noEmit |
| npm run lint | PASS, 0 errors và 0 warnings (lần cuối sau sửa hook dependency) |
| npm test | PASS 164/164, không skipped/todo; MODULE_TYPELESS_PACKAGE_JSON warning cũ |
| expo install --check | Exit1 vì 11 mismatch nền đúng backlog C; không upgrade |
| expo-doctor |19/20, một check dependency mismatch fail; không exclude che cảnh báo |
| expo export --platform all | PASS Android/iOS/Web và 36 static routes; xem log export cuối cho module counts |
| git diff --check | PASS; chỉ LF/CRLF notices ở các file B có từ trước |
| Backend | HEAD baseline, chỉ ?? qa/ từ trước, không Java/DB/test/Maven/seed/SQL |
| Web Admin/Booking | Không thay đổi trong D |
| Native/rendered | ADB devices rỗng, chưa có ảnh/visual phone-tablet hoặc native E2E |
| Real API/cross-app | NOT_RUN; chưa QA URL/accounts/dataset/quyền mutation xác nhận |

Test có ý nghĩa: scoped headers/exact-one credential/open scope/expiry/employee permission; journal concurrent intent/stale clear/owner/API/epoch isolation; late account response; no automatic sale retry/exact key replay; strict receipt và financial range; request ownership/full fulfillment; activity lifecycle/attendance/edit notes/quantity bounds/target identity; cùng request qua Passenger và POS adapters. Auth/voyage/check-in/entitlement/reader B/C tiếp tục pass.

Export cuối sau khi chốt source ra `CASMS_MobileApp/dist/phase-d` (ignored), giữ artifact để kiểm bundle. Không thêm fixture vào production hoặc đổi URL sang local test server. Không native prebuild/EAS build. Package.json/lock/app.json có thay đổi B từ trước, D không thêm dependency. FE_MAINTENANCE_BACKLOG giữ finding cũ và bổ sung xác minh D. Log đầy đủ typecheck/lint/tests/export nằm ở evidence; kết quả và source hashes trong verification.json.

Sau full suite 164/164, test riêng outcome có 11/11; lần full suite cuối đã bao gồm Fare snapshot/unit mismatch và conflict legacy/terminal journal.

Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS; không FULL_INTEGRATION_PASS. Lint/typecheck/export không thay thế QA nghiệp vụ, hardware hay migration gate.
