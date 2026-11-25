# CASMS Mobile Phase F — FE_REGRESSION

Ngày 25/11/2026. FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main + working tree B/C/D/E0 được giữ; BE0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc (?? qa/ từ trước). Baseline171 tests, typecheck/lint/export pass, Doctor19/20 và11 mismatch nền. Đọc AGENTS/OceVie Mobile, báo cáo0/A0/A/B/C/D/E0, handoff và source hiện tại; không dùng báo cáo thay contract. Chỉ sửa Mobile/tài liệu, không BE/DB/Web, SQL/seed/Maven, dependency mới, commit/push hoặc Folio/checkout. Áp dụng7 skill bắt buộc và frontend-testing-debugging, chi tiết SKILL_USAGE. Evidence là source/unit/contract/export trừ khi ghi rõ rendered; chưa có QA BE/DB xác nhận.

Baseline171 giữ toàn bộ assertions, F thêm18 thành189/189 pass,0 skipped/todo. SSE riêng9/9 là subset, không cộng thành198. File test mới notification-contracts.test.mjs/notification-realtime.test.mjs; shared tests/fixtures/passenger-api-server.mjs bổ sung port env/Notification REST/SSE/day fixture chỉ in-memory, không production adapter. Không dùng fixture để chứng minh Backend.

| Check | Evidence / kết quả |
|---|---|
| npm run typecheck | PASS, evidence/typecheck.txt |
| npm run lint | PASS,0 warnings/errors, evidence/lint.txt |
| npm test | PASS189/189, evidence/tests.txt; Node MODULE_TYPELESS_PACKAGE_JSON warning cũ |
| SSE controller/parser | PASS9/9, evidence/sse-tests.txt; fake timers/streams, KHÔNG real connection |
| npx expo install --check | Exit1, đúng11 mismatch nền, evidence/dependency-check.txt; không fix |
| npx expo-doctor |19/20, version mismatch check fail cũ, evidence/doctor.txt |
| expo export --platform all | PASS Android/iOS/Web,36 static routes; source đã chốt, output ignored dist/phase-f, evidence/export.txt |
| git diff --check | PASS, LF/CRLF notices trên file B cũ; evidence/git-diff-check.txt |
| UI runtime | AVD có SDK/ExpoGo, thử headless read-only; SystemUI ANR rồi Failed to download remote update; ảnh/XML ở evidence, product UI chưa load |
| Real API/realtime backend/cross-app/device E2E | NOT_RUN; chưa QA URL/accounts/dataset/quyền mutation xác nhận |

Tests F: nullable/count/read-all/noACK/dedupe/offset instants/exact BP/manual voyage switch/blocked route; parser CRLF/multiline/Unicode/bounds/unknown/malformed; bounded retry/authdeny/idle/cleanup/latecontext/scopepermission; day selection/internal draft; wrong ship/asset traversal/deck mismatch; Support không fake ticket. Existing timezone/Asian ports/overnight/midnight, auth/session/isolation, QR/NFC, C requests/activities/entitlement, D POS/statement/journal và E0 financial/Folio-block vẫn chạy.

SDK58 docs + installed expo/fetch source xác nhận API streaming có sẵn; không Expo Go/device pass từ docs. Không dependency mới, SDK upgrade, native prebuild, SQL/Maven/seed hoặc Backend startup. Production export phải không chứa localhost18085/18086 UI fixture; verification.json ghi scan artifacts/source hashes/POS/E0 unchanged. Giữ FE maintenance backlog, không exclude mismatch.

QA runbook G: xác nhận activated account và nhiều own voyages, private notifications/ack, published/unpublished changes/stop replacement, model publish/mapping và DB tách biệt. Test login→today→switch day→receive SSE notification→GETrefresh→read/read-all→manual switch correctBP; duplicates/out-of-order/malformed/disconnect/45s idle/max retry/foreground/expired/refreshed JWT/account/API switch; assert one active stream/no stale callback/no mutation replay. ACK test do BE/QA sau fix chỉ ảnh hưởng target; push/token và3D device benchmark gate riêng. Phone/tablet/font/Back/screen reader và native current-build + proxy test phải có evidence thực.

Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS, không REAL_API_PASSED/REALTIME_INTEGRATION_PASSED/DEVICE_E2E_PASSED. Runtime helpers/AVD do F khởi được dừng sau test; no firewall/network/security changes.
