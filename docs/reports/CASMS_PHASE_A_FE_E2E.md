# Phase A Frontend — Bằng chứng trình duyệt và E2E

## Kiểm thử trình duyệt bằng fixture

Web Admin production preview, Playwright với Edge cục bộ. Fixture cung cấp session và response API trong trình duyệt. Script từ root repo sau khi build Web Admin là `node CASMS_WebAdmin/tests/phase-a-browser.mjs`. Có thể đặt `CASMS_PLAYWRIGHT_MODULE` trỏ tới bản Playwright có sẵn và `CASMS_BROWSER_EXECUTABLE` trỏ tới Chromium hoặc Edge. Ảnh ở [phase-a-fe-evidence](phase-a-fe-evidence/).

- Ship, chuyến không cần khu SERVICE, hiển thị “Không áp dụng” và có CTA xác nhận ở 1440, 1366, 768 và 390 px. Test gửi thao tác ở viewport 1440.
- Ship, chuyến có dịch vụ, chỉ chọn cặp eligible và dùng chính terminal đã chọn. HTTP 409 khóa bước tiếp theo cho tới khi đối chiếu revision. Sau tải lại lần gửi kế tiếp dùng revision mới. Dialog trả ASM dùng số phân công Backend, kiểm Escape và trả focus.
- Ship, chuyến thiếu POS, thấy lý do khu vực chưa chọn đúng máy. Select bố trí dịch vụ và CTA xác nhận đều bị khóa. [Ảnh 768 px](phase-a-fe-evidence/ship-missing-pos-768.png)
- HR, phương án stale, thấy cảnh báo cần Ship kiểm tra lại. CTA nộp bị khóa và ô phân công theo nhu cầu được ẩn.
- Hồ sơ kỹ thuật hiển thị dữ liệu đủ và chưa nộp độc lập ngay trong Ship Review. Test Node kiểm revision nộp, quyền xét duyệt và maker/checker.

## E2E Backend thật

**PARTIAL trên API và trình duyệt thật. Full E2E BLOCKED tại Ship Review.** Frontend main `31249fd` với patch chưa commit, Backend `558049c`. PostgreSQL QA gốc tại cổng 15439 không phản hồi. Lượt nghiệm thu tạo cụm PostgreSQL loopback riêng tại 56577, database `casms_phase_a_fe` dưới Backend `target/phase-a-fe-live-f5066ed6`. Backend JAR chạy profile demo tại 56680 và migrate tới V139. Web Admin production preview chạy tại 5186. Các tiến trình QA được dừng sau lượt chạy.

| Vai trò và thao tác | Kết quả Backend thật |
| --- | --- |
| CRM tạo hành trình và Cruise | `POST /trips` 201, lưu và finalize lịch 200, `POST /cruise` 201. |
| CRM tạo yêu cầu staffing | `POST /cruises/{cruiseId}/staffing-requests` ban đầu 422 `PREPARATION_BUDGET_REQUIRED`. Sau `PUT …/preparation/operating-budget` 200 và GET revision mới, POST trả 200 và `PENDING_ASM`. |
| HR phân công Quản lý tàu, ASM hoàn tất chương trình | `POST /cruise/{cruiseId}/staff` 200. ASM nhận và hoàn tất qua `PUT /cruise-work/{cruiseId}/ASM` 200. Cả program-options và service-locations trả 200. Staffing tiến tới `PENDING_SHIP_REVIEW`. |
| Ship đọc phương án và kiểm revision | `GET /cruises/staffing-requests/{requestId}/review-details` 200, trả 0 khu vực, 0 dịch vụ, `ship.modelId=null` và `shipPlanReady=false`. `POST …/SHIP_CHECKED` với revision cũ trả 409 `STAFFING_REVISION_CONFLICT`. |
| Ship ký phương án trên model chưa đủ điều kiện | `POST …/SHIP_CHECKED` với revision mới nhất trả 409 `STAFFING_SHIP_PLAN_INCOMPLETE`. Tàu catalogue có tàu và boong, thiếu model READY cho tàu đang gán. Web Admin hiển thị điều kiện thiếu và khóa CTA. |
| Hồ sơ kỹ thuật độc lập | Ship nộp `POST /cruise/{cruiseId}/preparation/TECHNICAL_NAUTICAL/submit` 200. Ship tự gọi confirm nhận 403. Tài khoản OPS có quyền, dùng `GET /cruise-preparation-reviews/{cruiseId}/TECHNICAL_NAUTICAL` và `POST …/confirm` đều 200. |
| Đọc lại hồ sơ và trả ASM | `GET …/preparation` trả `CONFIRMED`, user duyệt khác user nộp và giữ submittedRevision 1. `POST …/SHIP_RETURN_ASM` 200. ASM nhận và hoàn tất lại, trạng thái quay về `PENDING_SHIP_REVIEW`. |
| Role ngoài phạm vi | Booking Agent có session thật. `GET /cruises/staffing-requests/inbox` trả 403 `STAFFING_INBOX_FORBIDDEN`. |

Edge/Playwright đăng nhập qua trang Web Admin, gọi Backend thật và mở route của CRM, ASM, Ship, HR, OPS và Booking Agent. Đã mở cả màn Ship Review của Cruise QA và kiểm nút xác nhận bị khóa trong khi hồ sơ kỹ thuật đã nộp. Các ảnh [Ship Review thật](phase-a-fe-evidence/real-qa-ship-review-1366.png), [ASM](phase-a-fe-evidence/real-qa-asm-1366.png), [CRM](phase-a-fe-evidence/real-qa-crm-1366.png), [HR](phase-a-fe-evidence/real-qa-hr-1366.png), [OPS](phase-a-fe-evidence/real-qa-ops-1366.png) và [Booking Agent](phase-a-fe-evidence/real-qa-booking-agent-1366.png) ghi nhận phạm vi này.

### Tái hiện và điều kiện còn thiếu

1. Tạo database loopback riêng, khởi động JAR Backend Phase A với profile demo, cấu hình JPA validate và để Flyway migrate bình thường. Chạy Web Admin build bằng Vite preview và đặt `CASMS_API_PROXY_TARGET` tới Backend loopback.
2. Dùng các tài khoản demo của repo. Gọi API tạo lịch trình trong seeder, tạo Cruise trên tàu catalogue, lưu ngân sách, tạo staffing, phân công Ship Manager và để ASM hoàn tất. Đọc review-details và gửi SHIP_CHECKED với revision hiện hành để tái hiện 409. Mã và trạng thái từng bước nằm trong [bằng chứng HTTP](phase-a-fe-evidence/real-qa-http.json).
3. Full E2E cần Cruise có đúng model READY đã gán. Kịch bản có service cần thêm khu vực SERVICE, máy POS hợp lệ và quyền SERVICE_READ. Từ đó mới kiểm thật các bước CRM gửi HR, HR gán và xử lý trùng lịch, CRM xác nhận, OPS duyệt staffing, trả Ship/HR và reset phân công. Open Sale và Booking Agent cần cấu hình thương mại và phân công Agent trên một chuyến đã qua Ready.

Bộ Backend `ItineraryProgramsPostgresIntegrationTest` đạt 22/22 trên PostgreSQL cô lập, gồm các tình huống V2, gate no-service, quyền POS, reset và kỹ thuật. Kết quả đó và ảnh fixture không được tính là Full E2E qua trình duyệt. [Kịch bản Backend](https://github.com/ShiroSs00/CASMS_Backend/blob/558049c8126bd14743069de01c5ab9e321140d47/docs/reports/CASMS_PHASE_A_BE_E2E.md)
