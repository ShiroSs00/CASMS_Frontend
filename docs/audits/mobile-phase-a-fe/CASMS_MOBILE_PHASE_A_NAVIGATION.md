# Splash, restore và điều hướng

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đã đọc Expo Router SDK 58, `src/app/{index,splash,loading,login,_layout}.tsx`, `(passenger)/_layout.tsx`, `staff-pos/_layout.tsx`, các alias A0 và POS guard hiện có. Sửa `login.tsx`, `_layout.tsx`, layout Passenger, `PosLayout.tsx`, `PassengerActionUI.tsx`, `PassengerLaunchScreen.tsx`, `PassengerLoadingScreen.tsx`, thêm `workspace-navigation.ts`.

| Luồng | Trước → sau |
|---|---|
| Mở app / mở login trực tiếp | Login trực tiếp có thể mount form khi restore → giữ trạng thái launch đến khi đọc xong SecureStore. |
| Passenger | Authenticated chuyển Home ngay → Loading chờ GET `/auth/me` đúng owner/role và GET `/itineraries/mine` nếu có BOOKING_READ, sau đó mở Home hoặc route được phép tiếp tục. |
| Staff và thiết bị | Dùng quy tắc POS hiện có. Staff vào POS, quyền được POS xác minh qua `/auth/me`. Tài khoản thiết bị vẫn nhận hướng dẫn dùng tài khoản nhân viên. |
| Vai trò khác/mixed | Có thể đi vào UI Passenger không tải được dữ liệu → thông báo vai trò chưa hỗ trợ và logout. |
| Deep link | Trước bỏ route khi đi login → preserve route nội bộ trong danh sách allowlist ở cold anonymous. UUID booking và tham số được kiểm. Đích phải thuộc đúng workspace, route ngoài hoặc không hợp lệ về landing. |
| Logout/expiry | Tránh quay lại hồ sơ cũ. Guard bỏ return intent của phiên đã kết thúc, dùng redirect/replace hiện có, giữ backBehavior history của tab. |
| Legacy | `/bookings`, `/explore`, `/passenger-bookings/new` vẫn redirect đến màn companion. |

Root cause là hai đường điều hướng login/loading riêng và thiếu phân loại một số vai trò. Không đổi cấu trúc file-based route hoặc thêm điều kiện nghiệp vụ cho terminal. Loading có retry, logout và trạng thái chờ kết nối, không có timeout UI giả. Expo Router hướng dẫn guard theo state; dùng guard đang có ở shell thay vì đổi toàn bộ thành Stack.Protected, để bảo toàn deep link.

**Acceptance:** test anonymous deep link, role landing, expiry và alias pass; chưa quan sát hardware Back/native deep link trên thiết bị. Deep link sau cold anonymous được kiểm ở helper. Khi đang signed-out/expired, intent cũ không được mang theo sang account mới. [Kiểm hồi quy](CASMS_MOBILE_PHASE_A_FE_REGRESSION.md).
