# CASMS Booking Agent — Test report

Ngày: 2026-11-19 (Asia/Saigon). FE `main@703c239`, BE `main@0cc292e`. Báo cáo lập trước commit; xuất bản sau kiểm chứng theo yêu cầu riêng của người dùng.

## Kết quả tổng hợp

| Check | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| npm ci trong workspace đang chạy | BLOCKED lần đầu | Windows EPERM unlink native Rolldown đang bị giữ. Không tắt server của người dùng hoặc đổi lockfile. Node_modules đã được khôi phục. |
| npm ci từ lockfile trong thư mục QA sạch | PASS | booking-agent-clean-ci.log: 171 packages. Source/tokens/tests được copy sang bản cài sạch; SHA-256 của 17 file nguồn/package/test liên quan trùng workspace. |
| npm run typecheck | PASS | booking-agent-locked-typecheck.log, exit 0. |
| npm run lint | PASS | booking-agent-locked-lint.log, exit 0. |
| npm run build | PASS | booking-agent-locked-build.log, exit 0; cảnh báo chunk >500kB, không lỗi build. |
| Targeted Booking unit/API tests | PASS 22/22 | 21 test mới + contract acceptance test sẵn có; booking-agent-locked-targeted.log. |
| Toàn bộ Web Admin unit tests | FAIL: 63 PASS / 1 FAIL | 64 tests; lỗi Cruise workspace đã tồn tại trên HEAD, phân tích dưới đây. |
| Impeccable detector | PASS, không finding | booking-agent-impeccable.json = []. Không phải chứng nhận accessibility tự động đầy đủ. |
| Browser integration dùng API giả lập | PASS | 9 nhóm checks trong booking-agent-browser.json; không có runtime error hoặc endpoint fixture ngoài dự kiến. |
| Browser E2E BE thật | PASS phần smoke; BLOCKED giao dịch thành công | booking-agent-live-browser.json. Đăng nhập, /auth/me, danh sách scoped rỗng và sale list thật. Không nhận là full transaction E2E PASS. |
| API thật negative scope/lookup | PASS | 403 quote/create/cabin/sellability ngoài assignment; lookup thiếu liên hệ 400, mã không tồn tại 404, ID không tồn tại 404. |
| Browser Safari/Firefox, thiết bị vật lý | SKIPPED | Kiểm tra bằng Edge Chromium và viewport emulation. |
| npm dependency audit baseline | Còn finding | npm ci lockfile sạch báo 10 vulnerabilities (9 moderate, 1 high). Package/lockfile không đổi; không tự npm audit fix hoặc nâng dependency ngoài yêu cầu. |

## Lệnh đã chạy

Trong CASMS_WebAdmin:

```powershell
npm ci
npm run typecheck
npm run lint
npm run build
node --import ./tests/helpers/import-loader.mjs --test ./tests/booking-agent.test.mjs ./tests/booking-contract.test.mjs
node --import ./tests/helpers/import-loader.mjs --test ./tests/*.test.mjs
```

Sau EPERM, `npm install --ignore-scripts --package-lock=false` được dùng để phục hồi dependency xóa dở, không đổi package/lockfile. Kiểm chứng cuối không dựa vào version được resolve bởi lệnh phục hồi: `npm ci` + typecheck/lint/build/tests chạy lại trên thư mục sạch `C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-clean-install` từ lockfile gốc. `booking-agent-source-match.json` xác nhận source được kiểm tra trùng workspace.

Browser plugin không được cài trong session, nên dùng Playwright đã có + Edge; không cài thêm dependency. URL UI QA `http://127.0.0.1:15196`. Script/evidence ngoài repo:

```powershell
node "C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-browser.cjs"
node "C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-live-browser.cjs"
```

## Unit/API tests

- Decode detail/optional financial/signature fields; malformed/missing installments bị từ chối.
- Phân trang list và số trang trả về; 403/404/500 không trở thành empty.
- History filter qua mọi trang booking, có chuyến đóng bán; không đọc catalogue sale làm nguồn lịch sử.
- Sale inspection giữ kết quả sellability, lựa chọn create loại unsellable.
- Lookup reference/email/phone validation.
- Quyền confirm/cancel/cabin; lifecycle Draft/Confirmed/Cancelled và route guard create.
- Unsellable cruise và cabin không đủ capacity không hợp lệ.
- Quote currency/amount từ BE, Idempotency-Key, quoteId và không tự gửi agreedFareAmount.
- Quote hết hạn không tạo booking.
- Recovery chỉ GET, kiểm tra cruiseId, storage tách owner, không chứa PII.
- 400/403/404/409/422 là explicit rejection; network/500 là unknown và không tự POST lại.

## Browser fixture — interaction thực sự đã chạy

1. List 21 kết quả/2 trang; chọn chuyến lịch sử đóng bán, xóa lọc; 403/500 có error, empty có giải thích scope.
2. Sale list: chỉ chuyến sellable có nút tạo, chuyến chưa đủ điều kiện không có CTA tạo.
3. Contract: mở review chưa POST, Tab focus ở dialog, Escape đóng; double click xác nhận chỉ một POST; refresh có Accepted.
4. Confirm: BE trả BOOKING_DEPOSIT_NOT_PAID thì lỗi tiếng Việt giữ trong modal; sau response hợp lệ, detail đọc lại Confirmed.
5. Legacy cabin: lựa chọn cabin khác còn chỗ, xác nhận, GET detail hiện cabin 102; không giả cập nhật local.
6. Cancellation case: review trước POST; chỉ PENDING_FINANCE, booking chưa bị hủy; timeout khóa gửi lại kể cả reload.
7. Lookup: thiếu field chưa gọi API; thông tin hợp lệ hiện kết quả; direct detail 403 không hiện passengers.
8. Create: wizard 3 bước, quote 100 VND hiển thị đúng currency, double click chỉ một POST, về detail.
9. Create timeout + reload: recovery GET tìm kết quả, số POST create không tăng. Đăng xuất A/đăng nhập B không còn dữ liệu A; direct detail bị BE giả lập từ chối không render hồ sơ.

Viewport UI fixture: 1440, 1280, 768, 390 px; list/detail/lookup/sale/quote được chụp và kiểm tra document không overflow. Bảng cuộn trong vùng riêng. Đã xem ảnh và sửa tràn sale table 768 px, action rail cuộn lồng, modal footer. Kiểm tra runtime errors và meaningful UI; không framework overlay. Account/scope trong lượt này do fixture cấp, không phải chứng minh authorization BE thật.

## E2E trên BE/PostgreSQL thật

Người dùng xác nhận được dùng database làm việc. BE cổng 8080 đã dừng giữa lượt audit; khởi động lại bằng start-local.ps1/start-be.bat hiện có, không sửa BE source. Launcher compile/package PASS (skip BE tests); Flyway validate PASS, schema up-to-date, max version 137. Không chạy lại/reset/repair migration hoặc schema.

Sau đối chiếu migration seed, dùng đúng tài khoản Booking Agent demo (không ghi token/password vào báo cáo). Login 200, /auth/me có role BOOKING_AGENT và 38 effective permissions.

DB `casms` hiện có:

- 0 Booking.
- 0 CruiseStaff ACTIVE với role BOOKING_AGENT.
- 0 Cruise PUBLISHED; 3 chuyến hiện có đều DRAFT.

Đã thực sự chạy UI đăng nhập và đọc dữ liệu thật: booking list rỗng đúng scope; sale list rỗng; bước tạo không bịa chuyến. Viewport thật 1440/768/390 không overflow. API thật quote/create vào chuyến chưa phân công trả 403; không tạo booking. Lookup thiếu liên hệ trả 400; mã chưa tồn tại/ID chưa tồn tại trả 404.

Không chèn booking giả, không đổi trực tiếp DRAFT thành PUBLISHED hoặc tạo khoản thu để ép E2E PASS. Không tạo dữ liệu nghiệp vụ QA vì chưa có chuyến hợp lệ; login/khởi động BE vẫn có các cập nhật phiên/initializer thông thường. BE hiện được giữ chạy tại 8080; không reset dữ liệu làm việc.

### Scenario status

| Scenario | Status |
|---|---|
| Agent có assignment tạo booking thật, contract/confirm/change cabin/lookup success | BLOCKED: thiếu chuyến sellable + assignment + booking/verified payment. |
| Agent không assigned: list rỗng, sale/cabin/quote/create ngoài scope | PASS với Booking Agent thật. |
| Hai Agent A/B có các booking/chuyến riêng biệt thật | BLOCKED: chưa có fixture nghiệp vụ được phân công. UI account isolation đã test bằng hai session giả lập. |
| Booking lịch sử chuyến đã đóng bán thật | BLOCKED: 0 booking. Unit/browser fixture PASS. |
| 400/403/404 real API | PASS theo receipt. |
| 409/500/network/expiry/unknown thành công-recovery | PASS unit/browser fixture; chưa nhận là kiểm thử fault injection trên BE thật. |
| Fare package group cabin assignment/change | BLOCKED contract BE, không workaround. |

## FAIL có sẵn, không che bằng sửa test

`tests/cruise-workspace.test.mjs:15`: “OPS with read access can reach transaction policy without entering the commercial editing workspace”. Test cấp mỗi CRUISE_READ và mong có transaction-policy/checks; source `features/cruises/model/preparation.ts` trên HEAD yêu cầu CRUISE_PRICING_APPROVE cho transaction-policy và CRUISE_VALIDATE cho checks.

Đã lấy source bằng `git show HEAD:...`, transpile/chạy riêng và so nội dung với workspace: `sourceUnchanged: true`, kết quả chỉ overview/schedule/changes. Receipt booking-agent-baseline-test.json. Không sửa test hoặc nới quyền để làm xanh; nằm ngoài 9 chức năng Booking Agent. Không báo toàn suite PASS.

## Evidence

- [Browser fixture receipt](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-browser.json)
- [BE thật browser receipt](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-live-browser.json)
- [BE thật read smoke](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-live-read-smoke.json)
- [BE thật negative API](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-live-negative-api.json)
- [Baseline failure proof](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-baseline-test.json)
- [Source SHA comparison](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-source-match.json)
- [Targeted tests](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-locked-targeted.log)
- [All tests](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-locked-all-tests.log)
- [Build](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-locked-build.log)
- [Lint](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-locked-lint.log)
- [Impeccable](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-impeccable.json)
- [UI list desktop](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-list-1440.png)
- [UI detail desktop](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-detail-1440.png)
- [Quote mobile](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-quote-390.png)
- [BE thật mobile](C:/Users/quanh/.codex/visualizations/2026/11/17/01a1e93a-9fef-7e61-87aa-d716b86b8b9a/booking-agent-live-empty-390.png)

## Kết luận nghiệm thu

Phần FE đã có code/test cho phạm vi có contract hỗ trợ. Chưa thể coi toàn nhiệm vụ nghiệm thu end-to-end đầy đủ: còn một FAIL nền, dữ liệu live chưa đủ cho happy path, và BE chặn đổi cabin fare. Cần xử lý các handoff ở báo cáo contract; không push/merge khi chưa được yêu cầu.
