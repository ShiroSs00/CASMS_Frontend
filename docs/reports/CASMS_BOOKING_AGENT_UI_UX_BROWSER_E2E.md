# Kiểm thử trình duyệt Booking Agent

Ngày 20/11/2026, giờ Việt Nam. Playwright điều khiển Microsoft Edge headless, sử dụng bản build của Web Admin trên Vite Preview tại `http://127.0.0.1:5184`. Phiên này không có Browser plugin kèm browser skill. Đã sử dụng Playwright có sẵn và Microsoft Edge với profile tạm. Cổng dev Vite trả 404 cho import nội bộ trên môi trường Windows thử nghiệm, còn bản build production chạy được.

Playwright chặn mọi request `/api` trong browser context và trả fixture cô lập. Dùng UI đăng nhập, điều hướng, nhập liệu và thao tác modal như nhân viên Booking Agent. Các request 403, 404, 400 và 503 được trả có chủ đích cho kịch bản lỗi. Đây là bằng chứng về hành vi trình duyệt với hợp đồng API mô phỏng.

| Nghiệp vụ | Thao tác và xác nhận thực tế |
| --- | --- |
| 01 · Danh sách | Mở danh sách, chuyển trang, lọc chuyến đã đóng bán và trạng thái, thấy empty theo bộ lọc, xóa lọc. Kiểm tra 403 hiện lỗi thay vì danh sách rỗng và tải lại được. Bộ lọc còn nguyên sau khi vào chi tiết rồi quay lại. |
| 02 · Tạo đặt chỗ | Từ CTA chuyến đủ điều kiện chọn cabin, thử tên trống, nhập liên hệ, thêm và bỏ hành khách, kiểm tra giữ thông tin khi chuyển bước. Nhận Quote và mở dialog, xác minh POST có `quoteId` và `Idempotency-Key`, đọc mã rồi mở chi tiết. Với HTTP 503, đóng dialog, reload, dùng GET Recovery với đúng key và kiểm tra số lượt POST. |
| 03 · Tra cứu | Enter gửi form. Mã để trống nhận focus và `aria-invalid`. Lỗi liên hệ giữ nguyên mã. Kết quả đúng liên hệ hiện ở chế độ chỉ đọc. |
| 04 · Chi tiết | Mở hồ sơ từ danh sách và ngay sau tạo. Kiểm tra dữ liệu chuyến, hành khách, hợp đồng và thanh toán. |
| 05 · Ghi nhận hợp đồng | Kiểm tra lỗi ô mã trống, đi Tab trong modal, đóng Escape và xác minh focus quay về nút kích hoạt. Mở lại, gửi mã và đọc trạng thái mới. |
| 06 · Xác nhận | Mở kiểm tra, gửi và thấy lỗi cọc từ BE mô phỏng ngay trong modal. Thử lần tiếp theo với phản hồi hợp lệ và kiểm tra trạng thái được đọc lại. |
| 07 · Hủy | Nhập lý do, xác nhận gửi, kiểm tra trạng thái “Chờ tài chính duyệt”. Booking vẫn giữ trạng thái sau khi tạo case. Nạp lại với case bị từ chối và kiểm tra trạng thái. Với fixture legacy, lịch sử case trả 404, gửi hủy trực tiếp và xác minh hồ sơ đã hủy sau readback. |
| 08 · Đổi cabin | Chọn hành khách và cabin mới, kiểm tra cabin hết chỗ vắng khỏi lựa chọn. Gửi đổi và thấy mã cabin mới sau readback. Booking thuộc gói fare có giải thích, không có nút đổi cabin. |
| 09 · Mở bán | Tải danh sách, chuyển lựa chọn sellability, kiểm tra chuyến không đủ điều kiện không có CTA. Mở wizard từ chuyến đủ điều kiện. |

## Kiểm tra hiển thị

- Kiểm tra trang, tiêu đề và khu vực nội dung thực. Các bước đạt assertion không có lỗi JavaScript ngoài những phản hồi HTTP dự kiến, không có overlay lỗi framework hoặc request fixture chưa được khai báo.
- Assert `document.documentElement.scrollWidth <= window.innerWidth` ở 1440, 1280, 1024, 768 và 390 px cho danh sách, chi tiết, tra cứu, mở bán, wizard và các dialog được chụp. Bảng có vùng cuộn nội bộ trên các chiều rộng trung gian.
- Kiểm tra bằng mắt các ảnh bảng, bố cục hẹp, cabin, thanh toán và báo giá. Đợt đầu phát hiện bảng tràn ở 1024 px và giá trị cabin bị dồn thành từng ký tự trong dialog. Đã sửa vùng bao bảng, bố cục so sánh và mở rộng vùng nhập ở tablet.
- Kiểm tra focus, Escape, Tab, lỗi gần trường và trạng thái đọc được. Sử dụng màu và control OceVie, chạy với `prefers-reduced-motion: reduce`. Chưa có chạy trình đọc màn hình hoặc quét WCAG tự động toàn bộ.

## Ảnh chụp

- Danh sách ở [1440](booking-agent-evidence/01-danh-sach-1440.png), [1280](booking-agent-evidence/01-danh-sach-1280.png), [1024](booking-agent-evidence/01-danh-sach-1024.png), [768](booking-agent-evidence/01-danh-sach-768.png) và [390 px](booking-agent-evidence/01-danh-sach-390.png).
- [Chi tiết desktop](booking-agent-evidence/02-chi-tiet-desktop.png), [đối chiếu hợp đồng](booking-agent-evidence/03-doi-chieu-hop-dong.png), [lỗi chưa đủ cọc trong dialog](booking-agent-evidence/04-xac-nhan-loi-coc.png), [đổi cabin](booking-agent-evidence/05-doi-cabin.png), [yêu cầu hủy tablet](booking-agent-evidence/06-yeu-cau-huy-tablet.png).
- [Tra cứu mobile](booking-agent-evidence/07-tra-cuu-mobile.png), [chuyến mở bán mobile](booking-agent-evidence/08-mo-ban-mobile.png), [chọn chuyến và cabin mobile](booking-agent-evidence/09-chon-cabin-mobile.png), [hành khách tablet](booking-agent-evidence/10-hanh-khach-tablet.png), [báo giá tablet](booking-agent-evidence/11-bao-gia-tablet.png), [tạo thành công](booking-agent-evidence/12-tao-thanh-cong.png).

## Backend thật

**BLOCKED.** Máy có PostgreSQL lắng nghe tại `127.0.0.1:5432`, nhưng API local `127.0.0.1:8080` chưa chạy. Launcher mặc định có thể áp dụng migration và đồng bộ role khi khởi động. Bộ thông tin QA local không cung cấp tài khoản Booking Agent phù hợp cho lần nghiệm thu này. Chưa chạy các mutation thật, gồm tạo và recovery, ghi nhận hợp đồng, xác nhận có thanh toán đối soát, hủy theo case/legacy và đổi cabin legacy.
