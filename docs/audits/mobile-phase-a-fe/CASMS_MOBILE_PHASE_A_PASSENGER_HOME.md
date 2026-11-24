# Passenger Home và Account

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đọc Home wrapper, `PassengerLiveHomeScreen`, `VoyageHomeParts`, Destination, Account, Booking Detail và primitive Passenger. Sửa Home, Account, card, Destination, đồng hồ và thêm chooser/model. Source tham chiếu là Me, Booking Detail, Cruise, Itinerary, Notification và đăng ký trong /mine.

- **Home trước → sau.** Tên user login và fallback tên tàu chung được thay bằng họ tên từ profile hoặc BookingPassenger khớp. Thẻ chuyến ưu tiên tên chuyến, tàu, trạng thái có chữ, ngày đi/về, phòng/tầng. Hiện trạng chưa có số phòng khác chưa gán và lỗi xác minh. Yêu cầu chọn nếu các chuyến ngang mức ưu tiên.
- **Lịch hôm nay.** Dùng ngày từ ItineraryDay và múi giờ tại từng ngày, kèm cảng từ stops nếu có. Nếu thiếu múi giờ hoặc nhiều ngày trùng tiêu chí, báo không xác định được. Hoạt động tiếp theo chỉ lấy đăng ký đã xác nhận còn ở tương lai và thuộc hồ sơ đang chọn. Cập nhật theo phút và khi app foreground.
- **Quick actions và thông báo.** Link tới screen hiện có theo quyền/context. Lỗi đọc thông báo có chữ riêng. Không dựng số dư hoặc QR giả. Booking cancellation vẫn hướng dẫn liên hệ như A0.
- **Account.** Lấy họ tên, email và số điện thoại nếu API trả. Tóm tắt chuyến và mở cùng chooser. Hỗ trợ và logout vẫn có. Không đưa giấy tờ vào query projection cho UI, không có edit/password/activation mới.

Dùng Expo Native UI, Design System, UI/UX Pro Max, Impeccable và Frontend Design cho hierarchy, trạng thái và tái sử dụng component. Dùng Expo Router giữ route navigation hiện hành.

**Acceptance:** DTO tests xác nhận nullable, owner mismatch, date/time, itinerary unavailable và upcoming registration. Android/iOS/Web export kiểm bundle. Nội dung cá nhân và tương tác thiết bị thật chờ môi trường QA. [UI/UX review](CASMS_MOBILE_PHASE_A_UI_UX_REVIEW.md).
