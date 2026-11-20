# Booking Agent · Regression và kiểm thử trình duyệt

Ngày 20/11/2026. Node.js 24.18.0. Dùng Playwright có sẵn và Microsoft Edge headless với Vite Preview. Browser plugin kèm skill không hiện diện trong phiên. Dùng fixture cô lập trên cổng 5184 và kiểm thử API thật riêng trên cổng 5185. Các ảnh chụp mang tiền tố `20`–`22` dùng Backend QA thật.

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS với `--max-warnings 0`. |
| `npm run build` | PASS. Còn cảnh báo kích thước chunk chung lớn hơn 500 kB. |
| Booking Agent + Booking Contract | PASS 27 bài. Gồm 5 bài mới về định dạng, giá và lỗi nghiệp vụ. |
| `node --import ./tests/helpers/import-loader.mjs --test ./tests/*.test.mjs` | 68/69 PASS. Một lỗi OPS đã tồn tại ở baseline. |
| Baseline OPS | Xuất `HEAD` local `59e56de` ra thư mục tách biệt và chạy riêng `cruise-workspace.test.mjs`. Tái hiện lỗi dòng 15, assertion thiếu `transaction-policy` ở dòng 17. Source `0a43895` trên GitHub vẫn yêu cầu `CRUISE_PRICING_APPROVE` cho mục này. Giữ nguyên test và quyền OPS. |
| Detector Impeccable | Danh sách finding rỗng trên layout và component đã chỉnh. |
| Browser fixture | PASS luồng chính 9 feature và các nhánh lỗi chạy trong fixture. |
| Real Backend | PASS smoke quyền, empty, not-found và denied. BLOCKED happy path với dữ liệu QA hiện có. |

## Browser fixture

Các luồng thao tác được chạy từ login, danh sách và bộ lọc đến wizard, tra cứu, chi tiết, hợp đồng, xác nhận, hủy, đổi cabin và mở bán. Assert trang có nội dung, không tràn ngang toàn trang ở 1440, 1280, 1024, 768 và 390 px, và không có framework overlay hay JavaScript error ngoài HTTP đã chủ đích. Ở 1024/1280, kiểm tra CTA chi tiết nằm trong vùng thấy được. Ở 660, kiểm tra gợi ý cuộn và dùng bàn phím cuộn bên trong bảng. Kiểm tra Tab/Escape và trả focus khi đóng modal hợp đồng.

| Nhánh từ chối | Mức kiểm tra |
| --- | --- |
| Agent chưa được phân công | Backend QA thật trả 403 cho sellability, cabin và quote. |
| Booking ngoài phạm vi | Chưa có booking để xác minh 403 với ID thật. 404 với ID không tồn tại đã chạy thật. Đối chiếu chiều kiểm tra scope trong `BookingService.validateAccess`. |
| Chuyến không sellable | BE thật trả `sellable=false`. Browser fixture ẩn CTA cho chuyến không đủ điều kiện. |
| Cabin hết chỗ | Browser fixture xác minh option hết chỗ bị loại khỏi đổi cabin. Booking tests xác minh wizard từ chối quá sức chứa. |
| Quote hết hạn / phiên bản giá đổi | Booking tests kiểm tra Quote hết hạn và 409 `FARE_QUOTED_PRICE_STALE`. Phiên bản giá cũ cần chọn lại và không gửi POST tạo đặt chỗ. |
| Hợp đồng chưa Accepted | Browser giữ nút xác nhận ở trạng thái disabled. |
| Cọc không đủ | Fixture mô phỏng số đối soát thay đổi từ 144 xuống 100 USD. POST 400 giữ lỗi. GET 500 không mở khóa. GET thành công giữ lỗi, thay số liệu và vẫn khóa vì còn thiếu cọc. |
| Hủy sai workflow | API fixture kiểm tra 409 `CANCELLATION_CASE_REQUIRED`. Browser kiểm tra tạo case, chờ, bị từ chối và hủy legacy khi được phép. |
| Đổi cabin fare | API fixture kiểm tra 409 `FARE_CABIN_CHANGE_NOT_SUPPORTED`. Browser xác nhận hồ sơ fare không có CTA đổi cabin. |
| HTTP và mutation chưa rõ kết quả | Browser chạy 400/403/404/500/503. Booking tests kiểm tra 409/422 và status 0. Browser xác minh POST tạo đặt chỗ trả 503, reload giữ khóa và dùng GET Recovery với cùng key. |

Browser nhắm đến loading danh sách, empty có lọc/không lọc, retry và permission. Các nhánh nghiệp vụ thiếu dữ liệu QA được kiểm tra bằng fixture hoặc source ở mức nêu trong bảng. Thực hiện rà soát trực quan, keyboard và reduced motion. Chưa chạy trình đọc màn hình hoặc kiểm tra WCAG toàn hệ thống.

## Ảnh chụp từ trình duyệt

- Danh sách [1440](booking-agent-final-evidence/01-danh-sach-1440.png), [1280](booking-agent-final-evidence/01-danh-sach-1280.png), [1024](booking-agent-final-evidence/01-danh-sach-1024.png), [768](booking-agent-final-evidence/01-danh-sach-768.png), [390 px](booking-agent-final-evidence/01-danh-sach-390.png).
- [Chi tiết](booking-agent-final-evidence/02-chi-tiet-desktop.png), [đối chiếu hợp đồng](booking-agent-final-evidence/03-doi-chieu-hop-dong.png), [lỗi cọc](booking-agent-final-evidence/04-xac-nhan-loi-coc.png), [cọc sau GET](booking-agent-final-evidence/04b-xac-nhan-sau-doc-lai.png), [đổi cabin](booking-agent-final-evidence/05-doi-cabin.png) và [yêu cầu hủy](booking-agent-final-evidence/06-yeu-cau-huy-tablet.png).
- [Tra cứu](booking-agent-final-evidence/07-tra-cuu-mobile.png), [mở bán](booking-agent-final-evidence/08-mo-ban-mobile.png), [chọn cabin](booking-agent-final-evidence/09-chon-cabin-mobile.png), [bước 2 mobile](booking-agent-final-evidence/09b-wizard-buoc-2-mobile.png), [hành khách tablet](booking-agent-final-evidence/10-hanh-khach-tablet.png), [báo giá](booking-agent-final-evidence/11-bao-gia-tablet.png) và [tạo thành công fixture](booking-agent-final-evidence/12-tao-thanh-cong.png).
- Ảnh và trạng thái HTTP của API thật ở [báo cáo E2E](CASMS_BOOKING_AGENT_REAL_BE_E2E_REPORT.md).
