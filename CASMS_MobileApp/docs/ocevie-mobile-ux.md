# OceVie Mobile

Nền tảng dùng logo OceVie, màu pearl/navy/teal/gold, token trong `src/constants/ocevie.ts` và các primitive Passenger hiện có. Scaffold dùng safe area. Sheet xử lý keyboard, khóa thao tác khi pending và theo tùy chọn giảm chuyển động cấp hệ thống.

| Tab Passenger | Route | Mục đích |
|---|---|---|
| Trang chủ | `/home` | Chuyến hiện tại và lối tắt |
| Lịch trình | `/itinerary` | Ngày, cảng, hoạt động và thay đổi |
| Dịch vụ | `/services` | Danh mục và yêu cầu trên tàu |
| Thông báo | `/notifications` | Danh sách, chi tiết và trạng thái đã đọc |
| Tài khoản | `/account` | Ngữ cảnh phiên, đặt chỗ đã có, hoạt động/gói và hỗ trợ |

`/passenger-bookings` và chi tiết là màn companion. `/bookings` và `/passenger-bookings/new` chuyển về danh sách, `/explore` chuyển về dịch vụ. `/cruise` đọc thông tin chuyến đã chọn. Check-in, hướng dẫn thẻ và hướng dẫn sao kê là màn riêng. POS dùng điều hướng và phiên scoped riêng.

Hiển thị loading khi đang xác minh, trạng thái rỗng khi dữ liệu đã tải, phản hồi lỗi có hành động tải lại và hướng dẫn khi cấu hình thiếu. Chi tiết đặt chỗ giữ trạng thái và lý do Backend trả, cùng hướng dẫn liên hệ nhân viên khi người dùng cần hủy. Xem [Passenger API](passenger-live-api.md) và [Staff POS](onboard-staff-pos.md).
