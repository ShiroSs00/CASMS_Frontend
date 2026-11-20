# Booking Agent · Hoàn thiện giao diện

Ngày 20/11/2026. Phạm vi là workspace Booking Agent trong Web Admin. Đã đọc bốn báo cáo của đợt triển khai trước, đối chiếu source thực tế, AGENTS, README và token OceVie. FE local ở `59e56de` với các thay đổi chưa commit được giữ lại. `main` trên GitHub đã xác minh ở FE `0a43895` và BE `276504f`. BE chạy từ checkout `0cc292e`. So sánh upstream cho thấy phần Booking khác ở hai ID của select, được Shared Field gắn theo `htmlFor`. Booking/Cancellation service và DTO không thay đổi giữa hai mốc BE.

| Khu vực | Thay đổi |
| --- | --- |
| Danh sách | Giảm chiều rộng tối thiểu bảng xuống 40 rem. Điều chỉnh độ rộng và đệm cột ở 1024/1280 px. Mã, trạng thái và liên kết chi tiết nằm trong vùng thấy được ở cả hai chiều rộng. Chỉ hiển thị gợi ý cuộn khi bảng thực sự cần thêm chiều ngang. URL filters, phân trang và bố cục danh sách hẹp tiếp tục được kiểm tra. |
| Wizard | Nhãn ngắn và ba ô tiến trình bằng nhau trên mobile, giữ tên đầy đủ cho trình đọc màn hình. Cặp nút Quay lại/Tiếp tục nằm trên cùng hàng ở màn hình hẹp. Giữ giá trị native ISO trong form và các bước Quote, Fare, Cabin, Recovery. |
| Hồ sơ | Badge trạng thái đặt chỗ nằm ngay sau tiêu đề. Có liên kết đến Hợp đồng, Thanh toán và Thao tác/hủy. Phần thông tin chuyến hiển thị metadata mà tiêu đề chưa có. Thao tác hủy vẫn xác nhận qua modal. |
| Định dạng | Ngày sinh trong chi tiết và bước xem lại dạng `dd/MM/yyyy`. Ô nhập ngày vẫn là native date input, có cách trình bày theo trình duyệt và giữ giá trị ISO. Timestamp dùng múi giờ Việt Nam và `HH:mm · dd/MM/yyyy`. Số tiền từ BE dùng định dạng vi-VN kèm currency nguồn. |
| Xác nhận | Sau `BOOKING_DEPOSIT_NOT_PAID`, modal đánh dấu giá trị đang hiển thị thuộc lần đọc trước, giữ nguyên lỗi BE và khóa xác nhận chờ GET chi tiết. GET cập nhật hồ sơ và modal, giữ lỗi của lần gửi trước. Chỉ thao tác xác nhận thủ công tiếp theo có thể gửi POST mới nếu trạng thái và dữ liệu mới thỏa điều kiện FE. |

## Tái hiện lỗi cọc

Fixture trước trả cùng 144 USD đã đối soát cả trước lẫn sau lỗi, rồi chấp nhận lần xác nhận kế tiếp. Điều đó không thể hiện một thay đổi nghiệp vụ giữa hai lần đọc. BE tính lại khoản thu có bằng chứng và trừ khoản hoàn đã hoàn tất tại thời điểm xác nhận. GET chi tiết và POST xác nhận diễn ra ở hai thời điểm.

Fixture mới bắt đầu với tổng 480 USD, mức cọc 144 USD, đã đối soát 144 USD. Sau một khoản hoàn được xác minh trong fixture, POST trả lỗi thiếu cọc và GET trả 100 USD đã đối soát, còn phải thanh toán 380 USD. GET đầu tiên cũng được mô phỏng lỗi 500 để kiểm tra khóa vẫn giữ. Sau GET thành công, modal hiển thị 100 USD và nút xác nhận vẫn khóa. Một lần thử khác có dữ liệu đủ cọc và POST thành công từ fixture. Browser kiểm chứng thông báo và nút ở cả hai trạng thái. Xem [lần đọc cũ](booking-agent-final-evidence/04-xac-nhan-loi-coc.png) và [sau khi GET chi tiết](booking-agent-final-evidence/04b-xac-nhan-sau-doc-lai.png).

## File và quyết định

- Các file chỉnh mới trong feature gồm `BookingAgent.module.css`, `RealBookingPages.tsx`, `RealBookingCreatePage.tsx`, `BookingRecord.tsx`, `BookingOperations.tsx` và `real-booking-view.ts`.
- `src/shared/cancellation/CancellationCases.tsx` cho phép Booking Detail truyền định dạng ngày của workspace và bỏ thông báo trạng thái lặp với badge đầu trang.
- `tests/booking-agent.test.mjs` bổ sung năm bài kiểm tra định dạng, phiên bản giá, workflow hủy và giới hạn cabin fare.
- Impeccable Operate hướng dẫn giữ mật độ và nhóm thao tác. UI/UX Pro Max hướng dẫn vùng cuộn có chỉ dẫn và focus. Frontend-design áp dụng cho nhãn ngắn, thứ tự đọc và thông tin xuất hiện ngay cạnh lỗi. Frontend-testing-debugging dùng bản build thực tế với Playwright và xem lại ảnh sau khi hiệu chỉnh.

[Báo cáo regression và ảnh](CASMS_BOOKING_AGENT_REGRESSION_REPORT.md).
