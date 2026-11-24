# Tích hợp API Passenger Mobile

OceVie Mobile phục vụ hành khách sau khi đặt chỗ trên Web. API base đến từ `EXPO_PUBLIC_API_URL`. Xem [cấu hình theo thiết bị](../README.md) và [điều kiện QA](real-api-qa.md).

| Nhóm | Contract Mobile đang dùng |
|---|---|
| Phiên | POST `/auth/login`, POST `/auth/refresh`, GET `/auth/me`. Logout dọn phiên và cache cục bộ. |
| Đặt chỗ | GET `/booking`, GET `/booking/{id}`, GET `/payment/booking/{id}`. Hướng dẫn liên hệ nhân viên đặt chỗ nếu cần hủy. Trạng thái và lý do hủy lấy từ chi tiết booking. |
| Chuyến và lịch trình | GET `/itineraries/mine`, `/itineraries/{id}`, ngày/điểm dừng/lịch sử trong adapter, GET `/cruise/{id}` cho tập thông tin chuyến đã chọn. |
| Dịch vụ | GET danh mục, availability và schedule. GET/POST `/servicepackage/requests`, PUT theo ID, POST hủy theo ID và GET khôi phục theo operation key. |
| Hoạt động | GET `/activities`, availability, tour theo điểm dừng. POST đăng ký hoạt động/tour, PUT cập nhật và POST trạng thái theo contract hiện có. |
| Gói | GET danh mục/benefit/assignment. Thao tác với assignment theo quyền và điều kiện draft hiện hành. |
| Check-in | GET status và POST start/complete theo bookingPassengerId khi đủ quyền. |
| Thông báo | GET `/notifications`, PATCH `/notifications/{id}/read`. |

FE giữ riêng userId, passengerId và bookingPassengerId. Quyền đến từ `/auth/me` của chính tài khoản. Session native được ràng buộc với API URL. Thay tài khoản hoặc logout dọn query cache. Lỗi 403 giữ phiên còn hạn. Mutation dịch vụ và POS giữ cơ chế chống ghi lặp và theo dõi kết quả chưa xác nhận.

Múi giờ của từng ngày và dữ liệu cảng lấy từ API. Cảng thiếu múi giờ hiển thị UTC có nhãn. Tiền tệ dựa trên response của từng bản ghi. QR nhận thẻ, NFC, Passenger Spending thật và SSE còn nằm ở các phase sau. [Backend handoff](../../docs/audits/mobile-phase-a0-fe/CASMS_BACKEND_HANDOFF.md).
