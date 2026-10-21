# OcvViet V12 — Five verified public Booking fixes

Ngày: 21/10/2026. Thực thi prompt V12 trong workspace hiện tại. Không thay API clients/DTOs, business validation, auth/guards, draft/session lifecycle, Admin, BE/DB/Flyway, dependencies hoặc Git history. Không commit/push, không gửi Booking mutation thật.

## Five highest-impact remaining defects

| Rank | Severity / màn hình | Bằng chứng trước sửa | Sửa và kiểm chứng |
| --- | --- | --- | --- |
| 1 | P1 — Guest Lookup | Fixture 404 đưa raw server detail vào UI; 403 lại có thông báo khác. Error sau request không có vùng focus phục hồi được đặt tên. | Dùng cùng thông báo no-match cho 400/403/404/422; thông báo riêng cho lỗi dịch vụ/rate limit, không đưa raw server text ra public UI. Focus vùng lỗi có tên, Shift+Tab quay lại form, giữ mã/contact. Không đổi HTTP response hay sửa security của BE. |
| 2 | P1 — GET/empty recovery | Hai alert hành trình/phòng đều tên chung, nút retry dính cùng dòng raw message; cabin rỗng chỉ có tiêu đề, không có retry tại chỗ. | Loading/error được gọi đúng tài nguyên, thông báo quyền/kết nối/dịch vụ phù hợp, nút riêng và khoảng cách rõ. Cabin/cruise rỗng có retry và link danh mục hiện có. Package failure vẫn có thể bỏ qua, không có mock fallback. Browser xác nhận retry cabin phát GET và không phát POST. |
| 3 | P1 — Uncertain POST | Sau fixture POST 503 và đóng modal, UI vẫn ghi “Chưa gửi được đặt chỗ”, dù kết quả chưa xác định; focus không về recovery. | Loại bỏ thông báo khẳng định chưa gửi trong public uncertain state. Nêu rõ có thể đã được tiếp nhận, giữ draft và khóa gửi lại. Đóng modal/Back từ lookup focus vào vùng phục hồi; Tab/Enter tới lookup chỉ khi đã có mã. Chỉ một simulated POST, không tự resubmit. |
| 4 | P2 — Guest representative email | Validator hiện có yêu cầu email guest, nhưng input không có `aria-required` và không có hint gắn với ô. | Truyền yêu cầu đã có từ session access vào public fields, thêm `aria-required` và hint liên kết. Giữ tên accessible “Email” và validator/API cũ; không bắt buộc email cho mọi hành khách/tài khoản. |
| 5 | P2 — Visual/keyboard focus | Outline vàng `rgb(202,150,50)` trên input trắng có contrast đo được **2.65:1**. | Outline navy 3px đạt **12.60:1** trên cùng nền; dùng cream cho focus trong heading navy. Giữ gold cho brand accents. Chỉ thay public Booking/Catalog selectors. |

Mỗi finding được tái hiện trước sửa bằng browser trên fixture DEV hiện có. Bốn regression assertions thất bại ở lần đầu; case uncertain được chạy lại sau khi sửa cách test ghi nhận focus của nút mở modal và đã tái hiện đúng lỗi false-rejection. Sau sửa, cả 5 cases PASS.

## Files V12

| Path | Mục đích |
| --- | --- |
| `src/features/booking/model/booking-feedback.ts` (mới) | Public-only read/lookup feedback; không thay response hoặc business states. |
| `src/features/booking/components/RealBookingUI.tsx` | Resource-specific public loading/error/retry; Admin dùng nhánh cũ. |
| `src/features/booking/components/LiveCruiseCatalog.tsx` | Copy recovery an toàn cho lỗi dịch vụ/kết nối của catalogue/detail. |
| `src/features/booking/components/LiveBookingFields.tsx` | Required semantics/hint cho email guest representative. |
| `src/features/booking/pages/RealBookingCreatePage.tsx` | Recovery khi dữ liệu rỗng, package error và uncertain submission; focus an toàn. |
| `src/features/booking/pages/RealBookingPages.tsx` | Lookup public message normalization và error-region focus; giữ nhánh Admin. |
| `src/features/booking/components/LiveBooking.module.css` | Focus contrast và bố cục text/action recovery public. |
| `src/features/booking/components/Booking.module.css` | Focus contrast trên catalogue public. |
| `tests/booking/feedback.test.mjs` (mới) | Hai unit tests cho public feedback boundaries. |
| `tests/booking/v12-recovery.browser.mjs` (mới) | Năm behavior/visual/a11y regressions, ảnh trước/sau ở cùng widths. |
| `docs/tasks/WEB-BOOKING-V12.md` | Contract local, allowed paths và baseline. |
| Báo cáo này | Kết quả và giới hạn kiểm chứng. |

Baseline: HEAD `e58770aa954be2508b5aedd0d7843e9890c74a28`, branch `codex/ocv-booking-ux-admin-logout-v7`. Backup/hash manifest 42 file dirty trước V12: `C:/Users/USER/AppData/Local/Temp/ocv-v12-baseline-jn4atdv7`. Chỉ 7 file public Booking trong baseline được sửa; 35 file còn lại giữ nguyên từng byte. V11 reports, helpers/fixtures/tests, API/auth/state/router/Admin hashes và HEAD không đổi.

## Visual evidence

**18 ảnh trước + 18 ảnh sau**, cùng six states, cùng dữ liệu DEV, cùng actual CSS widths **1280 / 1440 / 1920**, height 1000, full-page. Không tràn ngang trong các captures. JSON cạnh ảnh ghi viewport/focus/text/computed color phục vụ đối chiếu. Không coi dữ liệu mẫu là API live.

| State, 1440 px | Before | After |
| --- | --- | --- |
| Lookup error | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v12-before/lookup-error-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v12-after/lookup-error-1440.png) |
| Read error | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v12-before/read-error-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v12-after/read-error-1440.png) |
| Cabin empty | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v12-before/cabins-empty-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v12-after/cabins-empty-1440.png) |
| Uncertain outcome | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v12-before/uncertain-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v12-after/uncertain-1440.png) |
| Guest email | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v12-before/guest-email-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v12-after/guest-email-1440.png) |
| Focus | [Before](C:/Users/USER/AppData/Local/Temp/ocv-v12-before/focus-1440.png) | [After](C:/Users/USER/AppData/Local/Temp/ocv-v12-after/focus-1440.png) |

Các file `*-1280.png` và `*-1920.png` cùng tên ở hai thư mục trên. Bộ V11 regression cũng được chạy lại, tạo 33 ảnh tại `C:/Users/USER/AppData/Local/Temp/ocv-v12-v11-regression/` cho discovery/detail/cabin/passenger/review/result/lookup và các bounded states. Đã xem trực tiếp ảnh trước/sau read error, focus và uncertain, đối chiếu bố cục/hierarchy, spacing và màu focus.

## Verification

| Check | Kết quả thực tế |
| --- | --- |
| `npm run lint` | PASS. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS; còn warning chunk >500 kB. |
| Unit/contract/lifecycle tests | **28/28 PASS** — V11 suite cộng 2 public-feedback tests. |
| V12 browser suite | **5/5 PASS** — after fixes, explicit DEV fixture only. |
| V11 refinement browser suite | **3/3 PASS**, giữ nguyên file test cũ. |
| Existing Booking/auth/logout browser suite | **5/5 PASS**, giữ nguyên file test cũ; toàn bộ API bị intercept trong isolated harness. |
| Accessibility behavior | Tab tới fields, required/hint association, lỗi tại ô và không nhảy focus khi edit (V11); modal Escape trả focus về trigger; uncertain Escape/Back tới vùng recovery, Tab/Enter tới lookup; lookup Shift+Tab về form; keyboard Edit/Back giữ draft và focus heading. |
| Screen reader | Kiểm tra role/name/ARIA bằng browser DOM và accessible locators. **Chưa kiểm chứng thủ công bằng NVDA/JAWS**; không tuyên bố chứng nhận WCAG toàn bộ app. |
| Bundle isolation / scope | Không có DEV fixture/test markers trong production JS/HTML; không đổi dependency/production config. `git diff --check` PASS. |

Browser dùng Edge headless qua Playwright đã có sẵn. Preview là server development V11 port 5177, có banner DEV và không forward API tới BE; V12 không sửa server này. Test lookup thêm response lỗi tổng hợp trong isolated browser để kiểm tra text 404/403; không dùng dữ liệu khách thật hoặc tạo credentials.

## Remaining blockers / accuracy limits

Fresh read-only GET `/api/cruise?status=PUBLISHED` qua FE port 5173 trả **502**; request trực tiếp port 8080 bị connection refused ở lần probe V12. Browser thật hiển thị thông báo dịch vụ chưa sẵn sàng + Retry, không catalogue mẫu. Không điều tra/sửa startup/Flyway/permissions ở V12.

Không gửi live Booking/financial mutations. Live create/reference/lookup/contract/payment E2E và staff Logout E2E thật vẫn chưa được kiểm chứng vì BE/sandbox data/test session chưa sẵn sàng. Neutral lookup text chỉ sửa presentation: HTTP status/timing/error payload phía server vẫn thuộc trách nhiệm BE. Không thêm link/email hỗ trợ chưa được xác minh; recovery chỉ dùng route lookup hiện có khi đã nhận mã, giữ draft và dừng gửi lại nếu chưa có mã.

**Status: FE UI READY cho các thay đổi đã kiểm chứng bằng fixture. Live Booking E2E vẫn BLOCKED; không phải xác nhận production/API/payment readiness.**
