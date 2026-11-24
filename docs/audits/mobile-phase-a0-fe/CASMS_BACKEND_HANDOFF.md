# CASMS Backend Handoff — Phase A0-FE

Baseline FE `3c01db0412e29486ac750b0ebbcd090c6bed0353`, BE `0bc2b3831301a0d67d45bacc120a161dbacec026`. Hai local HEAD và remote main đã đối chiếu ngày 24/11/2026.

Đọc source Java liên quan và hồ sơ Phase 0. Tệp sửa trong nhánh handoff là tài liệu này dưới CASMS_Frontend. Expected/actual và nguyên nhân theo từng mục. Các trạng thái dưới đây dựa trên source cùng baseline và bằng chứng Phase 0. Phase A0-FE chạy test FE độc lập; không có QA API xác nhận để đánh dấu VERIFIED_FIXED.

## M06 (BE-01) — Folio cần ràng buộc phạm vi hành khách

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái / Phase FE | P0 / BLOCKED / E-FE |
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

## M07 (BE-02) — Folio trả dữ liệu mẫu khi thiếu ngữ cảnh

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái / Phase FE | P1 / BLOCKED / E-FE |
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

## M08 (BE-03) — Chốt bàn giao tài khoản từ Web

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái / Phase FE | P1 / BLOCKED / A-FE |
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

## M01 (BE-04) — Chốt workflow hủy cho Mobile

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái / Phase FE | P1 / OPEN / A-FE |
| Tham chiếu audit | M01 |
| File path | CASMS_Backend/src/main/java/com/casms/booking/controller/BookingController.java:323–334; booking/cancellation/controller/CancellationController.java:33–55; CASMS_MobileApp/src/features/passenger-actions/passenger-api.ts:149–151 |
| API liên quan | POST /booking/{id}/cancel; GET, POST /booking/{id}/cancellations |
| Expected behavior | Hành khách đi qua workflow hủy đã chốt và thấy đúng trạng thái case. |
| Actual behavior | FE gọi route trực tiếp. BE trả 409 CANCELLATION_CASE_REQUIRED khi workflow bật. GET/POST workflow mới đã có ở source. |
| Root cause | FE giữ contract legacy sau khi workflow chuyển sang case. |
| Ảnh hưởng đến Frontend | CTA hủy hiện tại không hoàn thành thao tác khi bật workflow. |
| Yêu cầu Backend xử lý | Chủ nghiệp vụ/Backend xác nhận Mobile chỉ dẫn Web hay được đọc/gửi case. Cung cấp scenario, trạng thái và error contract cho lựa chọn đã chốt. |
| Acceptance criteria | QA xác nhận CTA đúng kênh, trạng thái case nhất quán. Nếu Mobile được gửi case thì xác minh intake, header Idempotency-Key và lịch sử. |
| Blocker status | A0-FE đã bỏ thao tác hủy trực tiếp và hướng dẫn liên hệ nhân viên. Chờ xác nhận phạm vi case Web/Mobile cho phase sau. |

## M17 (BE-05) — Thống nhất kết quả gán dịch vụ vào khu vực

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái / Phase FE | P2 / OPEN / D-FE |
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
| Priority / trạng thái / Phase FE | P2 / OPEN / A-FE, H-FE |
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

## M13 — Cấu hình runtime

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P1 / OPEN |
| Source evidence và file path | CASMS_Backend/src/main/resources/application.yml |
| API | Datasource và JWT runtime |
| Expected behavior | Credential và JWT keys được cấp riêng bởi deployment. |
| Actual behavior | Source có giá trị mặc định. Chưa kiểm deployment thực tế. |
| Ảnh hưởng FE | Rủi ro phân tách môi trường và xác minh QA. |
| Yêu cầu BE | Chủ Backend rà cấu hình theo môi trường và xác nhận profile QA dùng cấu hình riêng. Không ghi giá trị bí mật vào báo cáo. |
| Acceptance criteria | QA và release chứng minh lấy cấu hình từ nguồn được quản lý. App chỉ nhận API URL đã xác nhận. |
| Phase phụ thuộc | A-FE/H-FE |

## BE-07 — Contract chi tiêu Passenger

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P1 / BLOCKED |
| Source evidence và file path | CASMS_Backend/src/main/java/com/casms/payment/controller/GuestPaymentExperienceController.java:83; src/main/java/com/casms/pos/PosController.java:239; CASMS_MobileApp/src/app/spending.tsx |
| API | GET /payment/guest/folio/statement; POS statement chỉ dùng Staff |
| Expected behavior | Passenger có contract folio, allowance và history dựa trên voyage/account đã xác thực. |
| Actual behavior | Mobile hiển thị hướng dẫn quầy. Contract folio hiện phụ thuộc M06/M07. |
| Ảnh hưởng FE | Chưa thể hiển thị chi tiêu thật hoặc số dư. |
| Yêu cầu BE | Cung cấp DTO và actor scope Passenger, cách lấy account, empty cases, precision, currency, limit và lịch sử. |
| Acceptance criteria | Sao kê Passenger khớp ledger QA, không lẫn tiền đặt vé, phân biệt không có dữ liệu và lỗi. |
| Phase phụ thuộc | E-FE |

## BE-08 — Trạng thái cấp thẻ Passenger

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P1 / OPEN |
| Source evidence và file path | CASMS_Backend/src/main/java/com/casms/pos/PassengerCardController.java:33–61; CASMS_MobileApp/src/app/passenger-qr.tsx |
| API | POST /checkin/passenger/{id}/card-claim; POST /pos/passenger-cards/{preview,confirm,lookup} |
| Expected behavior | Passenger nhận trạng thái đủ điều kiện, đã cấp và hết hạn theo projection API. |
| Actual behavior | Claim/preview/confirm/lookup đã có ở source. Chưa chốt cách Passenger đọc trạng thái thẻ đã cấp và xử lý claim lặp trên UI. |
| Ảnh hưởng FE | Không thể thiết kế QR và state transition đầy đủ theo contract hiện có. |
| Yêu cầu BE | Xác nhận endpoint hoặc projection chỉ đọc, mã lỗi, thời hạn và trạng thái cho Passenger. |
| Acceptance criteria | QA có ca chưa đủ điều kiện, cấp mã, hết hạn và đã cấp thẻ. FE đọc đúng trường đã xác nhận. |
| Phase phụ thuộc | B-FE |

## BE-09 — Mất thẻ và cấp lại

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P2 / OPEN |
| Source evidence và file path | CASMS_Backend/src/main/java/com/casms/pos/PassengerCardController.java; src/main/java/com/casms/pos/PassengerCardService.java |
| API | Passenger card claim và POS lookup |
| Expected behavior | Quy tắc vô hiệu hóa/cấp lại, actor và audit đã được xác nhận. |
| Actual behavior | Chưa thấy endpoint cấp lại/vô hiệu hóa trong controller đã đọc. |
| Ảnh hưởng FE | FE không có luồng an toàn cho thẻ thất lạc. |
| Yêu cầu BE | Chủ nghiệp vụ xác nhận có hỗ trợ trong Mobile không. Nếu có, cấp contract thay thẻ, mã lỗi và fixture. |
| Acceptance criteria | Kịch bản mất thẻ và cấp lại có kết quả nhất quán. Thẻ cũ không còn được công nhận khi đã vô hiệu hóa. |
| Phase phụ thuộc | B-FE/D-FE |

## BE-10 — SSE event contract

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P1 / OPEN |
| Source evidence và file path | CASMS_Backend/src/main/java/com/casms/notification/controller/NotificationController.java:30–75 |
| API | GET /notifications/stream, /unread-count; PATCH /read-all; POST /{id}/ack |
| Expected behavior | Event type, payload, session/reauth, heartbeat và reconcile được mô tả. |
| Actual behavior | Backend có SSE. Mobile dùng REST list/read. Chưa nghiệm thu event/reconnect thiết bị. |
| Ảnh hưởng FE | FE chưa có contract hoàn chỉnh để xử lý reconnect và UX khi app vào nền. |
| Yêu cầu BE | Cung cấp mẫu event, hành vi khi hết phiên và thứ tự đồng bộ REST, xác nhận read khác ACK. |
| Acceptance criteria | QA mất kết nối → reconnect đồng bộ đúng inbox và unread; logout dừng subscription. |
| Phase phụ thuộc | F-FE |

## BE-11 — Settlement và checkout

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P1 / BLOCKED |
| Source evidence và file path | CASMS_Backend/src/main/java/com/casms/payment/controller/GuestPaymentExperienceController.java:96; src/main/java/com/casms/payment/controller/InternationalCruisePaymentController.java:268 |
| API | POST /payment/guest/folio/express-checkout; settlement API |
| Expected behavior | Actor, thứ tự thanh toán, tổng và invoice từ cùng ngữ cảnh ledger. |
| Actual behavior | Có API ở source nhưng chưa xác nhận phạm vi Passenger Mobile và contract trạng thái. |
| Ảnh hưởng FE | FE chưa thể đưa thao tác checkout/settlement. |
| Yêu cầu BE | Chủ nghiệp vụ chốt phạm vi và cung cấp DTO, lỗi, idempotency, route deploy. |
| Acceptance criteria | QA checkout lặp, failed payment, thành công và invoice khớp ledger. |
| Phase phụ thuộc | E-FE |

## BE-12 — Pagination theo nhu cầu thực

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P3 / OPEN |
| Source evidence và file path | CASMS_Backend/src/main/java/com/casms/booking/controller/BookingController.java:237; src/main/java/com/casms/notification/controller/NotificationController.java:30; CASMS_MobileApp/src/features/passenger-actions/passenger-api.ts:90 |
| API | GET /booking; GET /notifications |
| Expected behavior | Booking pages đầy đủ. Nếu dữ liệu inbox lớn, query/pagination và ordering có contract. |
| Actual behavior | Booking dùng Page; inbox đang trả list. Chưa có số liệu QA để kết luận cần endpoint mới. |
| Ảnh hưởng FE | Cần dữ liệu vận hành để chọn giới hạn/lazy loading inbox. |
| Yêu cầu BE | Cung cấp dataset lớn và xác nhận pagination/cursor nếu vượt ngưỡng G-FE. |
| Acceptance criteria | Booking paging giữ đầy đủ dữ liệu. Quyết định pagination inbox có số đo và kiểm ordering. |
| Phase phụ thuộc | F-FE/G-FE |

## BE-13 — Checksum lock và assertions Flyway

| Hạng mục | Nội dung |
|---|---|
| Priority / trạng thái | P2 / OPEN |
| Source evidence và file path | CASMS_Backend/src/test/resources/flyway/migration-checksums.properties; src/test/java/com/casms/config/flyway/ |
| API | Migration/CI gate hỗ trợ Mobile QA |
| Expected behavior | Lock có V140 và assertions kiểm version hiện hành. |
| Actual behavior | Bằng chứng Phase 0 ghi lock thiếu V140 và 5 assertions còn mốc cũ; cùng baseline A0-FE. |
| Ảnh hưởng FE | QA chưa đóng gate regression database. |
| Yêu cầu BE | Chủ Backend/DB xem DB-02 và DB-03 trong Database handoff. |
| Acceptance criteria | Gate checksum và kiểm fresh/upgrade pass trên QA độc lập. |
| Phase phụ thuộc | H-FE |

Xem [kiểm thử Phase 0](../mobile-phase-0/CASMS_MOBILE_PHASE_0_TEST_REPORT.md) và [harness A0-FE](CASMS_MOBILE_PHASE_A0_TEST_HARNESS.md).

### Đối chiếu Phase A-FE ngày 24/11/2026

M08 tiếp tục **BLOCKED_BY_BACKEND**. `AuthService.java:51–80,122–129,155–184` gom sai thông tin và account không hoạt động vào `INVALID_CREDENTIALS`; `UserMeResponse` có UserStatus và hồ sơ Passenger, không có activation state. `BookingEmailService.java:103–114,217–225` có cả nhánh cấp mật khẩu tạm/ghi activated_at và nhánh kiểm token khi kích hoạt. `V94__booking_recovery_and_email_outbox.sql:20` định nghĩa bảng BookingAccountSetup. Web dùng `/auth/booking-account/activate` qua màn activation. Mobile dùng contract login hiện hành và hiển thị trường hợp chung. Để nghiệm thu, Backend/QA cần xác nhận email link theo trường hợp booking, tài khoản trước/sau kích hoạt, quan hệ User → Passenger và phản hồi login theo chính sách đã duyệt. Không đóng các finding còn mở.
