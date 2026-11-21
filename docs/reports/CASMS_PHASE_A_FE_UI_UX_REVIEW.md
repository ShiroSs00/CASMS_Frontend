# Phase A Frontend — Rà soát UI/UX

Frontend main `31249fd` với patch Phase A trong working tree. Chi tiết tệp và skill ở [Triển khai](CASMS_PHASE_A_FE_IMPLEMENTATION.md). Lệnh và kết quả ở [Hồi quy](CASMS_PHASE_A_FE_REGRESSION.md).

Workspace tái sử dụng Panel, Field, Badge, Notice, Button và Modal của OceVie. Ship thấy Chuẩn bị phương án tàu. OPS thấy Duyệt phương án nhân sự. Trang giữ mã chuyến, ngày khởi hành và người phụ trách. Dưới 900 px, phần tiến độ thu gọn còn bước hiện tại và mở được bằng bàn phím. Nút xác nhận dùng chiều cao mặc định OceVie trên màn nhỏ.

Khi chuyến sẵn sàng và không cần khu SERVICE, định biên hoặc ca, giao diện ghi “Không áp dụng” cho POS và “Không cần bố trí nhân sự” cho định biên. Khi Backend trả false hoặc null, nút xác nhận vẫn bị khóa. Chuyến chưa có nhu cầu hoặc ca không hiển thị bộ đếm nhân sự 0/0. Màn thiếu mô hình hiển thị blocker của mô hình và bỏ cảnh báo khu vực rỗng nếu chuyến chưa có dịch vụ hoặc khu vực để bố trí. Phần kỹ thuật hiển thị riêng dữ liệu, nộp và xét duyệt. Dialog reset hiển thị số liệu server. Hủy hoặc nhấn Escape giữ form, còn xác nhận gửi đúng revision.

| Kích thước viewport | Bằng chứng |
| --- | --- |
| 1440 px | [Phương án không cần khu vực phục vụ](phase-a-fe-evidence/ship-no-service-1440.png) |
| 1366 px | [Tổng quan Ship Review](phase-a-fe-evidence/ship-no-service-1366.png) và [dialog tác động](phase-a-fe-evidence/ship-reset-impact-1366.png) |
| 768 px | [Khu vực không áp dụng](phase-a-fe-evidence/ship-no-service-768.png) và [trường hợp thiếu POS](phase-a-fe-evidence/ship-missing-pos-768.png) |
| 390 px | [Bố cục một cột](phase-a-fe-evidence/ship-no-service-390.png) |

Các ảnh trên dùng fixture HTTP. [Ảnh Ship Review qua Backend thật](phase-a-fe-evidence/real-qa-ship-review-1366.png) cho thấy hồ sơ kỹ thuật đã nộp và nút xác nhận bị khóa do thiếu model READY. Các lượt fixture kiểm tra tràn ngang, Enter mở tiến độ, Escape, focus sau dialog và lỗi JavaScript. Detector Impeccable trả mảng rỗng khi quét StaffingV2 và StaffingInboxPage. Chưa kiểm tra với trình đọc màn hình hoặc thiết bị cảm ứng thật.
