# CASMS Mobile E0 — FE_REGRESSION

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, main, origin/main + working tree B/C/D được giữ nguyên; BE `0bc2b3831301a0d67d45bacc120a161dbacec026`, chỉ đọc, giữ ?? qa/ cũ. Baseline D:164 tests, typecheck/lint/export pass, Doctor19/20. Đã đối chiếu AGENTS gốc/Mobile, OceVie Mobile, báo cáo0/A0/A/B/C/D và handoff. E0 không sửa Backend/DB/Web, không SQL/seed/migration/Maven/API write thật, dependency, commit/push. Contract STATIC_VERIFIED từ source, chưa QA. Áp dụng7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE.

File sửa E0: src/app/spending.tsx; src/features/passenger-actions/booking-financials.ts; thêm PassengerSpendingScreen.tsx, spending-foundation.ts; thêm tests/spending-foundation.test.mjs. Không sửa POS Sale/Receipt/statement/journal, authentication/Voyage Context, QR/NFC/service/activity workflow. Bảo toàn toàn bộ working tree B/C/D.

Baseline164 tests; thêm7 tests →171/171 pass, không skip/xóa assertion. Tests formatter null/zero/unsafe precision/currency,4decimal, signed reversal và nonnegative booking; transaction status/scope label; missing voyage; unavailable khác missing account/empty; loading/offline/403/404/error không giữ context cũ; completed/cancelled không suy settlement; architecture guard Spending không financial transport/mock totals/checkout. Test guard ban đầu match cả refetch do regex quá rộng, đã sửa thành word boundary fetch; không nới điều kiện cấm Folio. Tests isolation A/C/D và POS outcome11/11 thuộc suite hiện có vẫn chạy.

| Kiểm tra | Kết quả |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS,0 errors/warnings |
| npm test | PASS171/171,0 skipped,0todo |
| expo install --check | 11 mismatch nền, exit1; không upgrade |
| Expo Doctor | 19/20, check dependency mismatch nền fail; exit1 |
| expo export --platform all --output-dir dist/phase-e0 | PASS Android/iOS/Web,36 static routes; source đã chốt trước export |
| git diff --check | PASS, chỉ LF/CRLF notices của file B cũ |
| Real API/cross-app/device | NOT_RUN, chưa có QAURL/accounts/dataset/quyền mutation được BE/DB xác nhận |
| Rendered UI | NOT_RUN, runtime browser/device blocker từ D; không dùng source tests/export thay visual QA |

Logs đầy đủ ở evidence; verification.json ghi source hashes và kết quả cuối. Expo SDK58/RN0.88.1/React19.3 giữ nguyên. Không thêm dependency, không audit fix --force, không seed/SQL/Maven/prebuild/build native. UI test fixture chỉ trong tests, không production API giả. Không thử ownership trên hệ thống đang dùng.

Acceptance SPENDING_FOUNDATION_READY_FOLIO_BLOCKED khi các FE checks hoàn tất; M06/M07 vẫn BLOCKED_BY_BACKEND, không FULL_INTEGRATION_PASS. Module E đủ điều kiện: formatter/state/copy/context và read-only package entitlement đã có. Account discovery/financial read/settlement/invoice chưa có gate tích hợp.
