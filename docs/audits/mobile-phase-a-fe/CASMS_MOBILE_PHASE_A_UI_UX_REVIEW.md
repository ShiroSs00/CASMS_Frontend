# UI/UX Native theo OceVie

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đã đọc OceVie Mobile, SafeArea Scaffold, Passenger Navigation/Button/Sheet, login keyboard field và Impeccable native audit. Sửa Login/Launch/Loading, Home/Account/Destination, chooser và InfoRow. Giữ vùng thao tác Staff POS, chỉ sửa role/deep link guard. Dữ liệu hiển thị lấy từ Me, Booking, Cruise, Itinerary và notifications đã xác nhận.

| Mục | Trước → Sau và evidence |
|---|---|
| Thứ tự thông tin | Home đặt danh tính, chuyến và phòng trước tiện ích. Account ưu tiên danh tính và chuyến đang chọn. Source kiểm được. |
| Chooser | Từng lựa chọn có tên chuyến, mã đặt chỗ, trạng thái/ngày; khi trùng booking hiển thị hồ sơ/cabin đã đối chiếu. InfoRow có accessibilityLabel và selected. |
| Loading và lỗi | Splash không mở form trước restore. Loading có retry/logout, paused có hướng dẫn kiểm mạng. Home phân biệt no booking, no voyage, thiếu phòng và lỗi tải. |
| Ngôn ngữ và màu | Tái sử dụng token và component. Badge, selection và lỗi có thông tin chữ. App không dùng màu/icon làm tín hiệu duy nhất trong các trạng thái mới. |
| Safe area, keyboard, font | Giữ scaffold, ScrollView, login KeyboardAvoidingView, sheet dismiss/pending và layout co giãn. Không áp đặt giới hạn cỡ chữ mới. |
| Motion và hiệu năng | Giữ reduced-motion và pause animation khi không foreground. Loading lỗi không chạy thanh tiến độ. Home tính ngày theo phút và khi resume, dùng cache theo entity. |
| Hành vi thiết bị | Expo Router tabs giữ history. Test source/policy cho role và deep link. TalkBack/VoiceOver, font scaling lớn, 320–375dp, orientation và hardware Back chưa được đo trên máy. |

Root cause chính là thứ tự ưu tiên chưa thể hiện đúng chuyến và UI chỉ có trạng thái tải/hiển thị rời rạc. Hướng xử lý áp dụng Expo Native UI, Design System, UI/UX Pro Max, Impeccable bản native và Frontend Design. Độ phủ evidence là source review, unit và export. **Acceptance FE sẵn sàng để QA**, việc xác nhận accessibility/navigation trên thiết bị còn mở.
