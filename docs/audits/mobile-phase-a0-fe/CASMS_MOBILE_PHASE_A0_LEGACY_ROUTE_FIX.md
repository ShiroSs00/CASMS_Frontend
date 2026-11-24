# Route legacy và phạm vi sản phẩm

Baseline FE `3c01db0`, BE `0bc2b38` trên `main`. Remote GitHub xác nhận cùng HEAD.

**Đã đọc:** toàn bộ `CASMS_MobileApp/src/app/`, entry/landing, `PassengerNavigation.tsx`, các consumer /cruise, route Web `CASMS_WebBooking/src/app/router.tsx` và BE Booking/Cancellation Controller. **Đã sửa:** `PassengerBookingScreens.tsx`, `passenger-api.ts`, `tests/passenger-actions.test.mjs`, `tests/mobile-foundation.test.mjs`, docs Mobile. Cấu trúc Expo Router hiện tại giữ các đường dẫn đã chia sẻ và role guard ở đúng layout.

| Route / file logic | Phân loại | Hành vi |
|---|---|---|
| `/` → `/splash` | REDIRECT | Entry ổn định cho launch. |
| `/splash`, `/loading`, `/login`, `/forgot-password`, `/support` | KEEP | Launch/restore/đăng nhập/hỗ trợ. |
| `/home`, `/itinerary`, `/services`, `/notifications`, `/account` và layout Passenger | KEEP | Tabs phục vụ chuyến đã đặt, có auth và role routing. |
| `/bookings` | REDIRECT | Alias cũ mở danh sách `/passenger-bookings`. |
| `/explore` | REDIRECT | Alias sang `/services`, giữ tham chiếu tab legacy và deep link. |
| `/cruise` | KEEP | Thông tin chuyến đang chọn, có consumer Home và Account. |
| `/passenger-bookings/new` | REDIRECT | Deep link cũ mở danh sách, không mở form tạo booking. |
| `/passenger-bookings`, `/passenger-bookings/[bookingId]` | KEEP | Danh sách/chi tiết, cabin, lịch sử thanh toán, trạng thái và lý do hủy. |
| `/passenger-services`, `/passenger-activities` | KEEP | Nghiệp vụ onboard và tour theo voyage. |
| `/passenger-packages` | KEEP | Giữ quyền lợi và thao tác có điều kiện hiện tại. Quyết định thay scope chỉnh draft thuộc phase sau. |
| `/check-in` | KEEP | Contract hiện hành và permission. Phạm vi pre-trip cần xác nhận ở B-FE. |
| `/passenger-qr`, `/spending` | NEED_BUSINESS_DECISION | Giữ màn hướng dẫn hiện có, API đầy đủ phụ thuộc B/E. |
| `/staff-pos`, `/staff-pos/{activities,requests,scanner,services,usage}` và layout | KEEP | POS theo terminal. Alias requests là entry đọc/xử lý dịch vụ có sẵn. |
| Root layout | KEEP | Config guard trước AppState/session/navigation. |

**M01 trước → sau.** Khi flag workflow mặc định bật, BE route hủy trực tiếp trả 409. UI từng mở form và gọi route cũ. UI hiện hướng dẫn liên hệ nhân viên đặt chỗ và đọc nguyên trạng Cancelled/reason. Web có route tương đối quản lý booking nhưng chưa có URL triển khai xác nhận để Mobile mở. Không còn consumer production hợp lệ của adapter hủy cũ. Test cũ đòi gọi POST đã chuyển thành xác nhận GET booking Cancelled còn đọc được, giữ lý do và không có adapter ghi. Test source kiểm route redirect, màn chi tiết, và guard cấm đưa mua vé vào Mobile.

**Acceptance:** alias và product boundary pass qua source regression; router/native deep links trên thiết bị chưa được chạy. Chủ nghiệp vụ xác nhận URL quản lý booking/kênh cancellation cho phase sau. [Backend handoff](CASMS_BACKEND_HANDOFF.md).
