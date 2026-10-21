# V13 — Booking scenario QA và bàn giao demo

21/10/2026. **UI DEMO READY (fixture-only); LIVE E2E BLOCKED.** Không tìm thấy P0/P1 FE mới sau các case dưới đây, nên **không sửa mã sản phẩm**. UI/CSS, API adapters/DTO, business validation, session, routes và Admin V12 được giữ nguyên. Không gửi real Booking POST, không sửa BE/DB/Flyway, không commit/push hoặc đổi branch.

## Gap table

Severity dưới đây mô tả rủi ro cần kiểm tra; không xem thiếu coverage là lỗi đã xác nhận. Chỉ được sửa production sau regression chứng minh P0/P1; số lỗi mới xác nhận/sửa: **0/0**.

| Scenario | Coverage trước V13 | Evidence mới / kết quả | Severity | Action |
| --- | --- | --- | --- | --- |
| Filter/pagination → detail → return/deep link, đổi cruise | V11 happy path + filter request; unit Spring-page mapping; chưa browser 2 trang/2 cruise | V13 case 1 PASS: page=2 được giữ khi quay lại, filter reset page; đúng ID đã chọn; đổi cruise xóa cabin/package, giữ contact | P1 risk, không tái hiện lỗi | Thêm fixture `catalog-pages` và browser regression |
| Chia sẻ phòng vừa sức chứa, người thứ 3, cabin sold-out sau 409 | Unit grouped capacity, browser capacity=1, rejection/retry cũ | V13 cases 2/3 PASS: hai người chọn cùng 101; người thứ 3 bị chặn; một simulated POST409 → fresh GET còn0 → không gửi lần hai | P1 risk, không tái hiện lỗi | `create-stale` + regression; không thay capacity rules |
| Optional/remove/stale package, nhãn giá/currency | V11 optional package failure + price precision unit | V13 cases 2/4 PASS: 20 USD riêng; xóa gói không mất draft; fresh INACTIVE bị loại, gói stale chặn review và có thể bỏ chọn | P1 risk, không tái hiện lỗi | `packages-stale` + regression; không tạo tổng tiền |
| Guest email, invalid/duplicate input, review/edit/back | V11/V12 guest required semantics/focus; unit contact/date/DTO validation | V13 case 2 PASS: email sai và duplicate normalized document bị chặn, sửa được; hai passenger và document giữ qua edit | P1 risk, không tái hiện lỗi | Bổ sung duplicate multi-passenger browser coverage |
| Submission lock/double click, unknown/timeout, modal recovery | Existing browser rapid double submit + V12 uncertain focus; unit network/408/5xx/malformed-success classification | Chạy lại nguyên suite PASS; V13 409 stale case bổ sung nhánh explicit rejection | P1 đã sửa V7–V12, không regression | Giữ nguyên locks; không retry unknown, không gọi live mutation |
| Lookup403/404/502/empty/offline/retry | V12 403/404 neutral copy/focus; V11 success/validation | V13 case 5 PASS: 403/404 cùng text, 502/null/network error không result/raw detail, input giữ, retry ready phục hồi | P1 risk, không tái hiện lỗi | Thêm scenarios + route abort chỉ trong browser test |
| Loading/error/empty/disabled + desktop | V11/V12 browser states/widths | Chạy lại V11/V12, không overflow tại 1280/1440/1920; 48 ảnh mới duy nhất trong V13 evidence dir | P2 regression check PASS | Không sửa visuals; không dùng ảnh cũ làm evidence mới |
| Fixture/live separation | Preview middleware bắt mọi `/api/`; production dùng live client | Browser API responses đều có header fixture; preview ép local `/api`; bundle build không có DEV reference/banner/scenario-control markers | P1 demo safety, không lỗi sản phẩm | Thêm banner chính xác `UI PREVIEW — NO LIVE BACKEND`; fail closed path lạ; single-operator runbook |

Các lần đầu của test mới có lỗi assertion/harness: đọc select trước khi GET tải xong, dùng heading không tồn tại, và chờ native `<option>` visible thay vì attached. Đã sửa test đồng bộ/selector theo DOM thật; không coi đây là defect sản phẩm hay dùng chúng để biện minh sửa FE.

## Các file thay đổi trong V13

- `tests/booking/preview-server.mjs`: chỉ môi trường DEV, thêm scenarios phân trang/stale/error, tab điều khiển scenario, banner và fixed local API base; không đổi production Vite config.
- `tests/booking/v13-scenarios.browser.mjs`: 5 tests mới tập trung vào các gap ở bảng; mỗi API response phải được đánh dấu fixture, các simulated POST chỉ tới loopback preview.
- `docs/tasks/WEB-BOOKING-V13.md`: task contract/baseline/allowed paths.
- `OCV_V13_DEMO_RUNBOOK.md`, `OCV_V13_BE_HANDOFF.md`, báo cáo này.

## Kiểm chứng thực tế

| Check | Kết quả |
| --- | --- |
| `npm run lint` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; warning chunk >500 kB còn tồn tại, không thuộc scope V13 |
| Unit/contract/lifecycle | **28/28 PASS**, không skip: 23 tests trong 6 files Booking/admin regression + 5 tests cruise/itinerary/auth-return |
| V11 refinement browser | **3/3 PASS**, nguyên file test cũ |
| V12 recovery browser | **5/5 PASS**, nguyên file test cũ |
| Existing Booking/auth/logout browser | **5/5 PASS**, nguyên file test cũ, API interception; không phải live staff test |
| V13 scenario browser | **5/5 PASS**; case/coverage như gap table |
| Tổng distinct cases | **28 unit/contract + 18 browser**, không cộng các lần chạy lại thành test mới |
| Desktop evidence | Fresh captures tại `C:/Users/USER/AppData/Local/Temp/ocv-v13-browser/`; 48 PNG unique, 1280/1440/1920. V11/V12 cùng tên `uncertain` nên bộ sau ghi đè 3 ảnh cùng state; không báo 51 ảnh unique. Đã xem ảnh uncertain1440. Không có thay đổi visuals cần before/after. |
| Baseline preservation | SHA-256 audit 46 files đã dirty trước V13: chỉ fixture server thay đổi, 45 files còn lại giữ nguyên từng byte. Snapshot `C:/Users/USER/AppData/Local/Temp/ocv-v13-baseline-zk2_w9wy`. `git diff --check` PASS. |
| Git / BE | Branch `codex/ocv-booking-ux-admin-logout-v7`, HEAD `e58770aa954be2508b5aedd0d7843e9890c74a28` giữ nguyên. BE status vẫn chỉ `.idea/misc.xml` modified và `openapi.json` untracked. |

Các lệnh unit/contract thực tế (từ CASMS_WebApp):

```powershell
node --test tests/booking/feedback.test.mjs tests/booking/presentation.test.mjs tests/admin/booking-recovery-logout.test.mjs tests/admin/booking-session-isolation.test.mjs tests/admin/v31-booking-activity.test.mjs tests/admin/admin-navigation.test.mjs
node --test src/features/booking/api/live-cruise-contract.test.mjs src/features/booking/api/live-itinerary-contract.test.mjs src/features/auth/model/auth-return.test.mjs
```

Browser dùng Edge headless/Playwright sẵn có. Preview suites chạy `--test-concurrency=1`, cùng port5177. Existing interception suite dùng `CASMS_TEST_URL=http://127.0.0.1:5173`; mọi API trong test được intercept. Không cài dependencies. Chi tiết chạy preview/browser: [runbook](OCV_V13_DEMO_RUNBOOK.md).

## Những việc vẫn BLOCKED

- Fresh safe GET 09:17:46 UTC: Cruise/Package/auth-me qua FE5173 đều502, trực tiếp8080 đóng kết nối; container restart vì Flyway V3 thiếu `UserRole`. Chi tiết endpoint/owner/retest gate tại [BE handoff](OCV_V13_BE_HANDOFF.md). Không suy ra lỗi403 lịch sử đã được sửa.
- Chưa có valid live published ID/cabin, authorized lookup data, staff session hoặc isolated mutation sandbox authorization. Live creation/reference/persistence/contract/payment và staff logout E2E không được tuyên bố PASS.
- Chưa kiểm NVDA/JAWS thủ công, toàn bộ tổ hợp business/financial status hoặc cross-browser. Unknown lock/draft là bộ nhớ context hiện tại; không hứa giữ qua đóng tab/reload. Source business ambiguity (authenticated passenger public-read policy) chuyển BE owner xác nhận, không đổi từ FE.
- Runbook D02 chỉ là simulated submission + canned lookup record; không phải round trip persistence. Demo không có thanh toán/ký hợp đồng thật. Không có P0/P1 FE mới được xác nhận trong phạm vi đã test; live blockers vẫn ngăn demo E2E thật.
