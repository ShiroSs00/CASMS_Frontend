# CASMS Backend Handoff

Nguồn Phase 0, FE `3c01db0`, BE `0bc2b38`. Handoff ghi yêu cầu cho chủ Backend/QA/DB. FE chỉ nối hạng mục phụ thuộc sau khi contract được xác nhận. Trạng thái blocker áp dụng theo chức năng hoặc gate ghi ở từng mục.

## BE-01 — Folio cần ràng buộc phạm vi hành khách

| Hạng mục | Nội dung |
|---|---|
| Priority | P0 |
| Tham chiếu audit | M06 |
| File path | CASMS_Backend/src/main/java/com/casms/payment/service/GuestPaymentExperienceService.java:1063,1080 |
| API liên quan | GET /payment/guest/folio/statement |
| Expected behavior | Trả folio thuộc booking/tài khoản mà hành khách được phép xem. |
| Actual behavior | Rà source cho thấy helper kiểm phạm vi chấp nhận quyền đọc dùng chung trước khi kiểm quyền sở hữu. Chưa xác minh kết quả trên QA cho toàn bộ vai trò. |
| Root cause | Quyền đọc thanh toán dùng chung cho nhiều vai trò, trong khi folio cần kiểm ngữ cảnh tài khoản. |
| Ảnh hưởng đến Frontend | Chưa thể nối Passenger Spending với contract này. |
| Yêu cầu Backend xử lý | Chủ Backend xác nhận mô hình owner/member/staff và trả contract folio riêng theo ngữ cảnh đã xác thực. |
| Acceptance criteria | Kiểm thử Backend xác nhận chủ tài khoản và thành viên được phép nhận đúng dữ liệu, các ngữ cảnh ngoài phạm vi bị từ chối theo contract. |
| Blocker status | Chặn tích hợp Passenger folio. POS statement theo phiên terminal là contract riêng. |

## BE-02 — Folio trả dữ liệu mẫu khi thiếu ngữ cảnh

| Hạng mục | Nội dung |
|---|---|
| Priority | P1 |
| Tham chiếu audit | M07 |
| File path | CASMS_Backend/src/main/java/com/casms/payment/service/GuestPaymentExperienceService.java:580–627 |
| API liên quan | GET /payment/guest/folio/statement |
| Expected behavior | Dữ liệu tiền, hạn mức và giao dịch đến từ ledger. Ngữ cảnh thiếu hoặc không hợp lệ có lỗi/trạng thái rỗng được quy định. |
| Actual behavior | Source có fallback thông tin chuyến, khách và hạn mức mẫu khi thiếu account/booking. |
| Root cause | Nhánh fallback demo còn trong service. |
| Ảnh hưởng đến Frontend | FE không thể xác định phản hồi là sao kê thật để hiển thị. |
| Yêu cầu Backend xử lý | Bỏ fallback mẫu trong contract Passenger và xác nhận DTO, tiền tệ, độ chính xác và nullable với FE. |
| Acceptance criteria | QA đối soát tổng và giao dịch với ledger; mọi trường hợp thiếu hoặc không tìm thấy ngữ cảnh trả đúng contract, không sinh dữ liệu mẫu. |
| Blocker status | Chặn Passenger Spending đọc folio thật. |

## BE-03 — Chốt bàn giao tài khoản từ Web

| Hạng mục | Nội dung |
|---|---|
| Priority | P1 |
| Tham chiếu audit | M08 |
| File path | CASMS_Backend/src/main/java/com/casms/notification/service/BookingEmailService.java:103; identity/controller/BookingAccountController.java:25; identity/controller/AuthController.java:34 |
| API liên quan | POST /auth/booking-account/activate; POST /auth/login |
| Expected behavior | Khách hoàn thành bước kích hoạt trên Web rồi dùng tài khoản đăng nhập Mobile theo nghiệp vụ đã nêu. |
| Actual behavior | Source email xác nhận có nhánh tạo mật khẩu tạm và ghi kích hoạt cho user mới. Auth login kiểm trạng thái tài khoản và mật khẩu. Chưa nghiệm thu chuỗi bàn giao từ Web. |
| Root cause | Hai cách bàn giao xuất hiện trong source. Quy trình áp dụng cho từng loại booking chưa được xác nhận. |
| Ảnh hưởng đến Frontend | FE chưa thể chốt hướng dẫn đăng nhập/kích hoạt và trạng thái lỗi trong luồng handoff. |
| Yêu cầu Backend xử lý | Chủ Booking/Identity xác nhận chính sách và mã lỗi/status trước/sau kích hoạt. Cung cấp fixture QA tương ứng. |
| Acceptance criteria | Tài khoản QA trước và sau bước kích hoạt có hành vi và hướng dẫn nhất quán trên Web/Mobile. |
| Blocker status | Chặn nghiệm thu handoff. Login/restore theo contract auth hiện có tiếp tục độc lập. |

## BE-04 — Chốt workflow hủy cho Mobile

| Hạng mục | Nội dung |
|---|---|
| Priority | P1 |
| Tham chiếu audit | M01 |
| File path | CASMS_Backend/src/main/java/com/casms/booking/controller/BookingController.java:323–334; booking/cancellation/controller/CancellationController.java:33–55; CASMS_MobileApp/src/features/passenger-actions/passenger-api.ts:149–151 |
| API liên quan | POST /booking/{id}/cancel; GET, POST /booking/{id}/cancellations |
| Expected behavior | Hành khách đi qua workflow hủy đã chốt và thấy đúng trạng thái case. |
| Actual behavior | FE gọi route trực tiếp. BE trả 409 CANCELLATION_CASE_REQUIRED khi workflow bật. GET/POST workflow mới đã có ở source. |
| Root cause | FE giữ contract legacy sau khi workflow chuyển sang case. |
| Ảnh hưởng đến Frontend | CTA hủy hiện tại không hoàn thành thao tác khi bật workflow. |
| Yêu cầu Backend xử lý | Chủ nghiệp vụ/Backend xác nhận Mobile chỉ dẫn Web hay được đọc/gửi case. Cung cấp scenario, trạng thái và error contract cho lựa chọn đã chốt. |
| Acceptance criteria | QA xác nhận CTA đúng kênh, trạng thái case nhất quán. Nếu Mobile được gửi case thì xác minh intake, header Idempotency-Key và lịch sử. |
| Blocker status | Chặn thay thế CTA hủy. Màn chi tiết booking và lịch sử tiền vé độc lập. |

## BE-05 — Thống nhất kết quả gán dịch vụ vào khu vực

| Hạng mục | Nội dung |
|---|---|
| Priority | P2 |
| Tham chiếu audit | M17 |
| File path | CASMS_Backend/src/test/java/com/casms/pos/PosPostgresIntegrationTest.java:770–782; src/main/java/com/casms/pos/PosService.java:77–87 |
| API liên quan | PUT /ships/{shipId}/areas/{areaId}/services/{serviceId} |
| Expected behavior | Khi thiếu gán vào tầng, thao tác quản lý có kết quả được mô tả và kiểm thử nhất quán. |
| Actual behavior | QA nhận 200 trong khi test mong 422. Sale thiếu gán tầng đã bị chặn ở bước trước. |
| Root cause | PosService.assign tạo deck assignment trước khi gán khu vực. |
| Ảnh hưởng đến Frontend | Nghiệm thu bối cảnh catalogue POS phụ thuộc vào quy tắc gán; Mobile Staff không thực hiện API quản lý này. |
| Yêu cầu Backend xử lý | Chủ POS/Ship chốt tự tạo deck link hay yêu cầu gán sẵn và đồng bộ tài liệu/test. |
| Acceptance criteria | Regression suite pass theo hành vi đã duyệt và chạy tiếp đến nhánh model archived. |
| Blocker status | Chặn đóng regression tương ứng. Không chặn các màn POS scoped đã có contract. |

## BE-06 — Fixture unit Booking thiếu NotificationService

| Hạng mục | Nội dung |
|---|---|
| Priority | P2 |
| Tham chiếu audit | Phase 0 test |
| File path | CASMS_Backend/src/test/java/com/casms/booking/service/BookingServiceTest.java:275,619 |
| API liên quan | Booking create/confirm, kiểm thử ở lớp service |
| Expected behavior | Unit test tạo và xác nhận booking chạy qua side effect thông báo. |
| Actual behavior | Surefire ghi 3 errors vì NotificationService null khi gọi notifyUser. |
| Root cause | Fixture unit thiếu dependency theo stack trace; chưa có bằng chứng production lỗi. |
| Ảnh hưởng đến Frontend | Giảm độ tin cậy regression cho bước chuẩn bị chuyến và bàn giao tài khoản. |
| Yêu cầu Backend xử lý | Chủ Backend đồng bộ fixture và assertions theo thông báo đã được spec hóa. |
| Acceptance criteria | Ca booking create/confirm pass và xác minh tác nhân nhận thông báo phù hợp. |
| Blocker status | Chặn gate unit của ca liên quan. Không chặn triển khai FE theo contract đã xác nhận. |

Bằng chứng chi tiết trong [báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md) và [ma trận API](CASMS_MOBILE_PHASE_0_API_CONTRACT_MATRIX.md).
