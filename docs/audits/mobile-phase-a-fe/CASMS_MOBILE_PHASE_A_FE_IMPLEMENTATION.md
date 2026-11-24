# Triển khai Phase A-FE

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đã rà báo cáo Phase 0/A0-FE, handoff, AGENTS, tài liệu OceVie, Expo SDK 58 và source các màn Mobile. Source Java và Web activation được đọc để xác nhận contract. Thay đổi tóm tắt theo phạm vi dưới đây.

| Phạm vi | File đã đọc/sửa | Nguyên nhân và kết quả trước → sau |
|---|---|---|
| Auth và handoff | `AuthController`, `AuthService`, `BookingEmailService`, `BookingAccountController`, DTO/enum, V94, Web activation. Sửa `src/features/auth/{session-model,session-store,login-model,workspace-navigation}.ts`, `PassengerLoginScreen.tsx` | Auth theo JWT từ BE, hiện không có activation field. Bổ sung UUID và validation mật khẩu theo NotBlank, giữ retry, 403 và API scope A0. Resume xử lý deadline trước khi focus query. |
| Navigation | Đọc `src/app/{index,splash,loading,login,_layout}.tsx`, layout Passenger/POS và các redirect legacy. Sửa `login.tsx`, `_layout.tsx`, `(passenger)/_layout.tsx`, `PosLayout.tsx`, `Passenger{Launch,Loading}Screen.tsx`, `PassengerActionUI.tsx` | Login có thể hiển thị trước restore; vai trò không hỗ trợ từng đi về Home; deep link mất intent. Landing tập trung, chờ Me/voyage cho Passenger, giữ internal route hợp lệ và có fallback hỗ trợ. |
| Voyage, lifecycle và DTO | Sửa `src/features/passenger-actions/{passenger-api,passenger-hooks,passenger-model,passenger-types,voyage-selection}.ts`, `AccountBoundScreen.tsx`, `itinerary-{api,client}.ts`, `PassengerLiveItineraryScreen.tsx`, Notifications cache key. Đọc Booking/PassengerItinerary/Cruise/Itinerary DTO và enum. | Chọn mặc định hàng đầu hoặc dùng cast lỏng → buộc explicit khi cùng hạng, revalidate cặp booking/passenger đã lưu, cache theo owner/backend/epoch và entity ID. Validate DTO mục đang dùng. |
| Home, Account, UI | Sửa `PassengerLiveHomeScreen.tsx`, `PassengerDestinationScreen.tsx`, `VoyageHomeParts.tsx`, `PassengerAccountScreen.tsx`, `ItineraryUI.tsx`, `hooks/use-now.ts`. Thêm `PassengerVoyageChooser.tsx`, `voyage-home-model.ts`. Đọc Scaffold, Navigation, Button, Sheet, Home wrapper và screen Booking Detail. | Bỏ fallback tên tàu chung, hiển thị tên/cabin/lịch hôm nay/hoạt động từ source xác minh. Account lấy họ tên/email/điện thoại thật và chia sẻ chooser. Kết quả trống, chưa gán và tải lỗi có thể phân biệt. |
| Kiểm thử và docs | Thêm `tests/auth-restore.test.mjs`, `tests/phase-a-voyage.test.mjs`. Cập nhật `live-api.test.mjs`, `passenger-actions.test.mjs`, `session-cleanup.test.mjs`, tài liệu audit và hai handoff A0. | Giữ các ca A0, sửa 2 fixture không đủ contract. Thêm coverage cho restore, expiry/resume, route theo role, chọn chuyến, cabin/null và lỗi DTO. |

Hành vi cancellation A0-FE giữ nguyên tại Booking Detail. Các thay đổi dùng Expo Router, Data Fetching, Native UI, Design System, UI/UX Pro Max, Impeccable và Frontend Design theo chức năng. [Kết quả kiểm thử](CASMS_MOBILE_PHASE_A_FE_REGRESSION.md) và [chi tiết skill](CASMS_MOBILE_PHASE_A_SKILL_USAGE.md).

**Acceptance:** cấu hình, auth/session, context và UI FE xác minh bằng test và export. Handoff kích hoạt, môi trường QA và native hardware Back chờ bằng chứng runtime.
