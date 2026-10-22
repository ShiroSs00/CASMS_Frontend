# OcvViet V11 — Booking UX/UI refinement

Ngày: 21/10/2026. Scope: public Booking desktop, giữ nguyên API adapters, DTO, business validation, session isolation và giao diện Admin. Không sửa BE/DB/Flyway/auth/permissions/router/Git history; không commit/push và không gửi Booking mutation thật.

## Thay đổi UX

| Màn hình | Cải thiện |
| --- | --- |
| Discovery/Search | Gom bộ lọc, bổ sung xóa bộ lọc và mô tả thứ tự khởi hành; tiêu đề card có link; empty state giải thích cách tiếp tục. Không thêm bộ lọc mà API chưa hỗ trợ. |
| Cruise Detail | Điều hướng nhanh tới thời gian/cảng và lịch trình/tàu; giữ filter khi chọn hành trình khác; focus bàn phím và wrap nội dung dài. |
| Cabin/Package | Giải thích chọn chung phòng theo từng hành khách; tóm tắt phòng đang chọn từ dữ liệu đã decode; tên loại phòng dễ đọc, giữ nguyên giá trị lạ từ API. Nêu rõ gói tùy chọn và giá gói chưa phải tổng Booking. |
| Passenger | Required/optional guidance, autocomplete phân biệt từng hành khách; error summary dẫn tới ô lỗi. Lỗi cũ của ô đang sửa được xóa, không nhảy focus sang ô khác; vẫn kiểm tra lại bằng validator hiện có khi tiếp tục. Lỗi loại giấy tờ có inline error/ARIA tương ứng. |
| Review | Link sửa phòng/gói và sửa thông tin hành khách; giữ draft khi đi/về; rail cho biết thời gian và số hành khách đã chọn phòng/gói. Không tự báo giá tổng. |
| Result | Mã đặt chỗ nổi bật, copy/lookup và các bước tiếp theo; focus vào heading kết quả; tách Booking status, contract status và lịch yêu cầu thanh toán. Không trình bày lịch thanh toán thành bằng chứng đã trả tiền. |
| Lookup | Giải thích email **hoặc** điện thoại, inline validation và focus ô còn thiếu; giữ reference từ màn kết quả, focus kết quả sau tra cứu. |

Giữ navy/cream/gold, tái sử dụng token và shared UI hiện có. CSS refinement được giới hạn trong public wrapper; Admin giữ variant cũ. Không thay lifecycle draft, confirmation modal, submission lock hoặc uncertain-write recovery.

## Files thay đổi trong V11

Production source:

- `src/features/booking/components/Booking.module.css`
- `src/features/booking/components/LiveCruiseCatalog.tsx`
- `src/features/booking/components/RealBookingUI.tsx`
- `src/features/booking/components/LiveBooking.module.css`
- `src/features/booking/components/LiveBookingFields.tsx`
- `src/features/booking/components/PublicBookingRecord.tsx` (mới, public-only)
- `src/features/booking/model/booking-presentation.ts` (mới, format hiển thị; giữ precision giá từ server)
- `src/features/booking/pages/RealBookingCreatePage.tsx`
- `src/features/booking/pages/RealBookingPages.tsx`

Verification/documentation:

- `tests/booking/preview-server.mjs` — môi trường fixture development riêng.
- `tests/booking/refinement.browser.mjs` — desktop journey/state/accessibility regression tests.
- `tests/booking/presentation.test.mjs` — không làm tròn mất precision tiền từ API; không bịa category cho cabin type lạ.
- `tests/admin/booking-logout.browser.mjs` — chỉ cập nhật một assertion heading public lookup theo section mới; các assertions khác giữ nguyên.
- `docs/tasks/WEB-BOOKING-V11.md` — contract local.
- Báo cáo này.

Baseline: HEAD `e58770aa954be2508b5aedd0d7843e9890c74a28`, branch `codex/ocv-booking-ux-admin-logout-v7`. Backup/hash manifest của 35 file thay đổi trước V11: `C:/Users/USER/AppData/Local/Temp/ocv-v11-complete-baseline-v078heqo`. Trong 35 file đó, V11 chỉ sửa 6 file Booking trong phạm vi và 1 assertion browser test; 28 file còn lại giữ nguyên từng byte. `RealBookingUI.tsx` là tracked file chưa có thay đổi tại baseline. API/auth/session/router hashes không đổi.

## Môi trường development fixture — không phải API live

FE thật: `http://127.0.0.1:5173/cruises`.

Preview có nhãn: `http://127.0.0.1:5177/cruises?__fixture=ready`.

Chạy lại từ CASMS_WebApp:

```powershell
node tests/booking/preview-server.mjs
```

Server preview chỉ bind loopback, chỉ hoạt động development và không được import vào production app. Mọi trang có banner “DEV FIXTURES — Dữ liệu và hành động mô phỏng. Không tạo Booking thật. Không phải kết quả API live.” Mọi `/api/*` được xử lý trước proxy; path không hỗ trợ bị từ chối, không chuyển BE. Response có header `X-Ocv-Development-Fixture: true`. Submit chỉ mô phỏng trong memory, không lưu record và không tạo credentials. Không có automatic fallback trên FE thật.

Các scenario qua query `__fixture`: `ready`, `loading`, `empty`, `error`, `cabins-empty`, `packages-empty`, `package-error`, `lookup-mismatch`, `create-rejected`, `create-unknown`. Scenario dùng chung trong một preview process; dùng để review tuần tự, không phải môi trường dữ liệu đa người dùng.

## Validation

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS; còn cảnh báo bundle chunk >500 kB, không chặn build.
- Unit/contract/lifecycle suite — **26/26 PASS**: core Booking, DTO mapping, capacity/contact validation, Admin navigation/logout/session retirement, auth-return, cruise/itinerary contracts và 2 presentation regressions.
- V11 isolated browser suite — **3/3 PASS**, gồm complete fixture journey, states, error focus, draft-preserving edit paths và uncertain-submit lock.
- Existing isolated Booking/auth/logout browser suite — **5/5 PASS** sau lần chạy cuối; một assertion public section heading cũ đã được cập nhật cho UI mới. Không phải authenticated live staff test. Tổng hai browser suites: **8/8 PASS**.
- Desktop: actual CSS viewport **1280, 1440, 1920 px**, không tràn ngang và không thiếu target `aria-describedby` trong các màn đã test. Có **33 ảnh** tại `C:/Users/USER/AppData/Local/Temp/ocv-v11-evidence/`.
- Các màn có ảnh ở cả 3 widths: discovery, detail, cabin, passenger, review, result, lookup-result, catalogue error/empty, lookup validation, uncertain outcome. Loading được chờ/quan sát bằng browser test; disabled cabin/package và modal submit lock được assert bằng hành vi.
- Đã xem trực tiếp ảnh discovery/detail/cabin/passenger/review/result/lookup và kiểm tra browser FE thật/preview. Ảnh passenger sau sửa không còn error của tên/email đã nhập hợp lệ.
- Kiểm tra bundle JS/HTML: không chứa implementation/data của preview fixture. `git diff --check` PASS.

Browser tests dùng Edge headless qua Playwright đã cài sẵn; không thêm dependency hoặc lockfile. Những kết quả mô phỏng không chứng minh Backend hoạt động.

## Blockers còn lại

Trong V11, browser FE thật và HTTP probe thực tế vẫn nhận **502** cho GET `/api/cruise?status=PUBLISHED`; GET trực tiếp `/api/v3/api-docs` không trả response hợp lệ ở thời điểm probe. BE container đang khởi động lại giữa các lần kiểm tra. Không chuyển lỗi thật thành catalogue mẫu.

Vì BE chưa sẵn sàng ổn định và chưa có sandbox mutation authorization, chưa kiểm chứng live Cruise/Detail/Cabin, tạo Booking, reference lookup hay contract/payment states. Staff Logout E2E thật vẫn thiếu tài khoản/phiên test. Xem bàn giao BE/V9 cho chẩn đoán trước đó; 403 cũ không được coi là bằng chứng của runtime hiện tại đang trả 502.

**UX refinement đã được kiểm chứng bằng fixture; readiness cho Booking live đầy đủ vẫn BLOCKED bởi BE và đầu vào sandbox.**
