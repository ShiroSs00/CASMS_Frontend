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

### Phase B-FE 25/11/2026

BE-08/09 giữ OPEN. BE-10 là SSE, không thuộc Phase B. Claim/preview/confirm/lookup đã xác minh source; FE đã có QR và native adapter sau khi người dùng duyệt dependency. Chưa nghiệm thu API thật. Chi tiết bổ sung BE-08/09 và BE-14 dưới đây, không đóng finding bằng unit test.

**BE-08 bổ sung:** Priority P1, OPEN; blocker cho tự cập nhật trạng thái thẻ tại Passenger. File `CASMS_Backend/src/main/java/com/casms/pos/PassengerCardController.java`, `PassengerCardService.java`; API POST `/checkin/passenger/{id}/card-claim`. Expected: Passenger đọc assignment hiện tại mà không phải tạo mã mới. Actual: response claim chỉ code/expiresAt, assignment được báo qua PASSENGER_CARD_ALREADY_ASSIGNED khi POST; không có GET projection trong controller. Root cause xác minh: không có projection đọc riêng trong source đã kiểm. Ảnh hưởng: UI chỉ biết assignment khi server báo lỗi, không biết quầy vừa cấp thẻ khi QR còn mở. Yêu cầu BE: xác nhận projection/refresh contract và fixture. Acceptance: GET hoặc projection được chốt trả assignment đúng owner, không lộ UID, chưa cấp/đã cấp/revoke có semantics rõ; API QA chứng minh. Không chặn render QR hoặc POS preview.

**BE-09 bổ sung:** Priority P2, OPEN; blocker riêng nghiệp vụ cấp lại. File `CASMS_Backend/src/main/java/com/casms/pos/PassengerCardService.java`, `src/main/resources/db/migration/V138__passenger_nfc_card_checkin.sql`; API card-claim/confirm/lookup. Expected: chính sách mất thẻ/cấp lại/revoke rõ actor và audit. Actual: source gán một thẻ mỗi BookingPassenger, có unique UID theo cruise, chưa thấy route replacement/revoke. Root cause chính sách chưa được cung cấp; không kết luận lỗi DB. Ảnh hưởng: FE không mở cấp lại hay thu hồi. Yêu cầu BE: quyết định phạm vi và contract; Acceptance: thẻ cũ bị từ chối khi revoke nếu chính sách yêu cầu, thẻ mới đúng owner/cruise, audit và retry được kiểm trên QA.

## BE-14 — Đối soát cấp thẻ và giới hạn native/permission

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / blocker status | BE-14 / P1 / OPEN; BLOCKED cho nghiệm thu timeout/recovery sau restart và deployment QA |
| File path | CASMS_Backend/src/main/java/com/casms/pos/PassengerCardController.java; PassengerCardService.java; PosAccessService.java; CASMS_Backend/ios/PassengerCardPOS/CardReader.swift |
| API | POST /pos/passenger-cards/preview, /confirm, /lookup; POST /checkin/passenger/{id}/start và /complete |
| Expected behavior | Quy trình confirm mất response có đối soát/recovery chính thức, quyền cấp và dùng thẻ được chốt; mobile check-in giữ phạm vi được duyệt. |
| Actual behavior | Confirm không có idempotency key/status theo operation. Lookup trả assignment theo UID trong cruise, có thể đối chiếu BookingPassenger khi UID còn memory. Ba route card cùng POS_ACCESS + CHECKIN_BOARDING. Check-in service giới hạn online ba giờ trước departure. |
| Root cause | Source không có operation-status/idempotency cho confirm; chưa có business runbook recovery/replacement, chưa có xác nhận phạm vi Mobile. UID identifier không phải xác thực mật mã. |
| Ảnh hưởng Frontend | FE khóa replay trong flow khi có thể đã gửi confirm; lookup đúng UID/BookingPassenger mới báo server xác nhận. Sau restart không persist UID/claim để khôi phục; cần quản lý đối soát. Không cấp quyền sale dựa lookup. |
| Yêu cầu Backend xử lý | Xác nhận lookup reconciliation đủ dùng hoặc cấp contract recovery nếu cần; chốt permission cấp/dùng thẻ, giới hạn UID và phạm vi check-in Mobile. Cung cấp QA với đúng role/session/cruise và timeout sau commit. Không yêu cầu sửa RBAC chỉ để FE chạy. |
| Acceptance criteria | Timeout trước/sau commit, duplicate tap, UID đã thuộc người khác, wrong-cruise, claim hết hạn/consumed đều có kết quả an toàn; xác nhận người nhận đúng BP; app restart có runbook; không auto replay confirm; QA có evidence. |

## Phase C-FE — đối chiếu 25/11/2026

FE giữ baseline a6bd1d6 + working tree B; BE vẫn 0bc2b38, chỉ đọc. M06/M07/M08/M09/M13/M17 và BE-08/09/14 không được đóng bởi source/unit FE. C không dùng Folio production, không sửa RBAC và không sửa Staff POS workflow. API/scope mới chỉ STATIC_VERIFIED; QA thật còn thiếu.

## BE-15 — Projection availability, usage và legacy quota cho Passenger

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / status / phase | BE-15 / P1 / OPEN / C-FE, liên quan D-FE; blocker riêng ship-scoped eligibility và legacy quota/history |
| File path | CASMS_Backend/src/main/java/com/casms/servicepackage/controller/ServicepackageController.java; service/ServiceCatalogReadService.java; ServicepackageService.java; ServiceRequestService.java; ServiceUsageQuotaService.java; entity/ServiceUsage.java; CASMS_Backend/src/main/java/com/casms/cruisepackage/service/CruisePackageEntitlementService.java |
| API liên quan | GET /servicepackage/services, /services/{id}/availability, /services/{id}/schedules, /requests; GET /booking/{id}/cruise-package-entitlements; legacy /packages/{id}/benefits và /package-assignments |
| Expected behavior | Passenger nhận rõ eligibility theo cruise/ship/BP, quota đã dùng/còn lại và historical location/usage khi các thông tin này được sản phẩm yêu cầu. |
| Actual behavior | Catalogue và availability service là global, availability không nhận cruise/BP. POST mới kiểm shipServices/port-call/hours/entitlement. Purchased Fare projection có remaining nhưng legacy TourPackage component chỉ là configuration; chưa thấy Passenger GET usage rows. Request response có aggregate fulfilledQuantity/completedAt, không có historical location projection. |
| Root cause xác minh | Read DTO không cung cấp các scope/field trên; legacy quota kiểm bằng SQL khi reserve/update. Không kết luận phép tính global capacity là lỗi nếu đó là business rule đã duyệt. |
| Ảnh hưởng Frontend | FE chỉ công bố global catalogue/capacity và slot đúng cruise, kiểm lại trước POST; không nói dịch vụ có sẵn trên tàu chỉ do availability=true. Legacy quota/usage rows không được dựng giả hoặc trừ local. |
| Yêu cầu Backend | Xác nhận semantics global versus per-ship, projection Passenger khả dụng, legacy quota/usage/history và timezone khi không gắn port. Cung cấp contract/fixture hoặc xác nhận giới hạn sản phẩm; không thay rule chỉ để FE hoạt động. |
| Acceptance criteria | QA service ngoài ship, hết slot/global capacity, giờ hoạt động, port-call đóng, granted/pending/used quota, legacy package và historical closed schedule có response rõ; unknown khác 0; BP khác không bị lẫn. |
| Blocker status | OPEN/BLOCKED cho các projection thiếu, không chặn catalogue/detail, request CRUD/recovery hoặc purchased Fare entitlement read đã có. |

## BE-16 — Canonical activity/excursion registration, Fare linkage và recovery

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / status / phase | BE-16 / P1 / OPEN / C-FE, D-FE; tham chiếu M09 và giữ M06/M07 |
| File path | CASMS_Backend/src/main/java/com/casms/activity/controller/ActivityController.java; service/ActivityService.java; controller/OnboardOperationController.java; service/OnboardOperationService.java; service/ShoreExcursionService.java; CASMS_Backend/src/main/java/com/casms/cruisepackage/service/CruisePackageEntitlementService.java |
| API liên quan | POST /activities/{id}/registrations, /activities/excursions/{id}/registrations, /activities/registrations/{id}/{confirm,cancel}; PUT registration; GET registrations/fare-entitlement; controller alternative /api/onboard-operations/activities/book |
| Expected behavior | Canonical Passenger registration/confirmation và Fare grant/fee semantics được chốt, timeout recovery và quyền đọc cho người có EXCURSION_BOOKING rõ, trùng lịch có policy thống nhất. |
| Actual behavior | Standard register kiểm owner/cruise/capacity/duplicate và trả PENDING; ở source đã đọc không thấy reserve Fare grant trong hai hàm register. Alternative bookActivityWithFolio có charge/legacy inclusion semantics khác và không phải route C đang sử dụng. Standard registration không có operation key/idempotency identity; read/reconcile cần ACTIVITY_REGISTRATION hoặc ATTENDANCE, khác EXCURSION_BOOKING. Capacity/duplicate đa số lỗi IllegalStateException chưa có stable business code. Không thấy passenger cross-target schedule-conflict projection trong standard register. |
| Root cause | Các đường workflow và projection chưa có contract nghiệp vụ thống nhất cho Mobile. Không suy refund/charge/entitlement từ price hay tồn tại package. |
| Ảnh hưởng Frontend | C dùng standard route có ownership, không tự nối Folio hay coi register đã consume Fare quota. Sau timeout không auto replay, GET danh sách trước thao tác tiếp. Nếu chỉ EXCURSION_BOOKING mà thiếu read permission, đối soát cần nhân viên. |
| Yêu cầu Backend | Chốt canonical route/state/actor, linkage grant và phí; xác nhận scope và ownership của alternative endpoint trước khi bất kỳ FE dùng; cung cấp recovery/runbook sau timeout/restart, stable errors và policy overlap/read permission theo nghiệp vụ. Không yêu cầu FE đổi RBAC. |
| Acceptance criteria | QA same BP+target duplicate, khác target trùng lịch, schedule đổi/hủy, expired target, quantity/capacity, cấp grant/fulfillment, timeout trước/sau commit, confirm/cancel lặp và EXCURSION_BOOKING-only; response không giả thành công/thu phí. |
| Blocker status | OPEN/BLOCKED phần Fare transaction, overlap policy và E2E recovery; không chặn standard read/register/confirm/update/cancel theo contract hiện có. |

## BE-17 — Package assignment write trên Mobile

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / status / phase | BE-17 / P2 / NEED_BUSINESS_DECISION / C-FE |
| File path | CASMS_Backend/src/main/java/com/casms/servicepackage/controller/ServicepackageController.java; service/ServicepackageService.java; CASMS_MobileApp/src/features/passenger-actions/PassengerPackagesScreen.tsx; PassengerBookingScreens.tsx |
| API liên quan | POST/PUT/DELETE /servicepackage/package-assignments/{bookingPassengerId}; GET /booking/{id}/cruise-package-entitlements |
| Expected behavior | Mobile phục vụ sau booking; quyền chỉnh gói draft/đổi gói sau booking chỉ mở khi chủ nghiệp vụ xác nhận. |
| Actual behavior | Backend còn legacy assignment write cho TOUR_PACKAGE_ASSIGN; baseline FE có CTA chỉnh draft. Chưa có quyết định đưa thao tác này vào Passenger onboard companion. |
| Root cause | Khác biệt scope sản phẩm và UI legacy, không phải thiếu quyền cần tự sửa. |
| Ảnh hưởng Frontend | C bỏ CTA ghi khỏi màn Passenger Packages và draft booking, đổi sang read-only purchased entitlement với BOOKING_READ. Adapter cũ giữ để bảo toàn các test/caller được phép, không có UI C gọi. |
| Yêu cầu Backend/nghiệp vụ | Xác nhận Mobile chỉ đọc hay có workflow đổi gói, lifecycle/permission/price/audit và fixture nếu được duyệt. |
| Acceptance criteria | Có quyết định kênh Web/Mobile và acceptance cụ thể. Nếu read-only thì không production CTA mua/chỉnh; nếu được ghi thì contract và regression riêng trước triển khai. |
| Blocker status | NEED_BUSINESS_DECISION riêng package write; read entitlement tiếp tục. |


### Phase D-FE — bổ sung ngày 25/11/2026

BE-14 giữ P1/OPEN: `/pos/passenger-cards/lookup` trong PassengerCardController/PassengerCardService cần POS_ACCESS + CHECKIN_BOARDING. Nhân viên chỉ có SERVICE_SALE không thể lookup. Expected: chính sách xác định hành khách cho quầy sale được chủ nghiệp vụ chốt; actual: quyền boarding là điều kiện hiện hành. Root cause xác minh từ annotation/PosAccessService, không sửa RBAC. Ảnh hưởng: FE chỉ hiện reader khi đúng quyền; BP/account UUID vẫn được sale API kiểm. Yêu cầu BE: xác nhận chính sách hoặc contract lookup riêng phù hợp. Acceptance: sale-only và boarding staff được kiểm trên QA, ngoài cruise/owner bị từ chối; không tự cấp quyền. Blocker: lookup sale-only và B2 native chưa đóng; các sale khác tiếp tục.

BE-15/BE-16 giữ OPEN: fulfillment hiện recordUsage từ request, optional Fare operation projection và activity attendance đã STATIC_VERIFIED. Chưa có usage-list/legacy remaining quota thống nhất; registration/fare/recovery cần QA theo runbook D. Không đóng các finding bằng adapter test. Database fixture tiếp tục DB-04/06, không tạo backlog trùng.

## BE-18 — Danh sách terminal được phép cho nhân viên POS

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority | BE-18 / P2 |
| File path | CASMS_Backend/src/main/java/com/casms/pos/PosController.java; PosAccessService.java; PosStaffResourceController.java |
| API | GET /ships/{shipId}/pos-terminals; POST /pos-terminals/{terminalId}/sessions |
| Expected behavior | Nhân viên có POS_ACCESS biết terminal nào được sử dụng mà không cần quyền quản trị. |
| Actual behavior | List cần POS_MANAGE, không thấy endpoint employee allowed-terminal discovery trong source đã kiểm. Open vẫn kiểm assignment. |
| Root cause | Contract hiện tại phân biệt management list và session open; chưa có employee discovery. Không kết luận lỗi RBAC. |
| Ảnh hưởng FE | Chooser chỉ cho người có POS_MANAGE; nhân viên thường nhập UUID do quản lý cấp. Không tự gọi route quản trị hay tạo terminal giả. |
| Yêu cầu Backend xử lý | Chốt phương thức discovery/onboarding hoặc cung cấp API danh sách scoped đúng employee/ship/cruise. |
| Acceptance criteria | QA nhân viên chỉ thấy terminal được phép; revoked/disabled/ngoài cruise không mở được; device credential không lộ trong list. |
| Blocker status | BLOCKED_BY_BACKEND cho employee discovery; open/current/close theo contract hiện hành tiếp tục. |

## BE-19 — Đối soát sale khi không có saleId và không thể replay

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority | BE-19 / P1 |
| File path | CASMS_Backend/src/main/java/com/casms/pos/PosController.java; PosService.java; PosDtos.java; PosLedgerService.java |
| API | POST /pos/sales; GET /pos/sales/{saleId}; GET /pos/accounts/{accountId}/passengers/{bookingPassengerId}/statement |
| Expected behavior | Có quy trình đối soát có audit khi response mất sau commit và assignment/quyền đã đổi. |
| Actual behavior | Same-key exact-intent POST replay được hỗ trợ; GET cần known saleId. Không thấy GET theo key. Statement history account-wide không có BookingPassenger ID; không đủ làm chứng cứ riêng cho operation mất response. |
| Root cause | Contract recovery hiện phụ thuộc session/terminal replay hoặc known ID; chưa có quy trình management theo operation identity được cung cấp. |
| Ảnh hưởng FE | Giữ SecureStore journal, không key mới, không tự kết luận fail. Khi không replay được phải liên hệ quản lý; không bịa endpoint hoặc lọc history bằng Passenger ID. |
| Yêu cầu Backend xử lý | Xác nhận runbook quản lý đối soát terminal/key/employee/cruise và quyền truy cập; nếu có API thì cung cấp DTO/ownership/errors/audit. Xác nhận history là account-wide. |
| Acceptance criteria | QA timeout sau commit/restart/quyền bị thu hồi tìm đúng một sale/request/charge/debit; khác intent conflict, không lộ dữ liệu ngoài scope; outcome rõ trước tiếp tục. |
| Blocker status | BLOCKED_BY_BACKEND cho recovery ngoài replay hiện hành; replay thủ công đúng contract đã tích hợp, REAL_API chưa chạy. |

## BE-20 — Contract bán sản phẩm tại POS

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority | BE-20 / P2 |
| File path | CASMS_Backend/src/main/java/com/casms/pos/PosController.java; PosDtos.java; PosStaffResourceController.java |
| API | POST /pos/sales chỉ SaleInput.serviceId; product management routes không phải sale API |
| Expected behavior | Nếu nghiệp vụ yêu cầu bán product, contract phải có product/quantity/unit/pricing/stock/charge/recovery đúng scope. |
| Actual behavior | Source sale hiện hỗ trợ service và quantity=1. Không xác nhận product sale contract; CRUD product không chứng minh bán hàng. |
| Root cause | Thiếu contract trong phạm vi source đã kiểm, không kết luận database thiếu bảng hoặc tự dùng serviceId làm productId. |
| Ảnh hưởng FE | Không hiện product-sale CTA hay gọi CRUD để giả giao dịch. Service sale tiếp tục. |
| Yêu cầu Backend xử lý | Chốt product sale có thuộc phạm vi hay deferred; nếu có, cung cấp route/DTO/permission/idempotency và stock semantics. |
| Acceptance criteria | Contract được duyệt và QA kiểm giá/stock/quantity/charge/replay/scope; không ghi trùng. |
| Blocker status | BLOCKED_BY_BACKEND riêng product-sale; không chặn service sale/fulfillment. |


**M17 — đối chiếu D, giữ trạng thái cũ:** PosAccessService/PosService/PosActivityService tiếp tục quyết định area/ship/deck/cruise và giao policy nguồn→area→terminal→employee. D dùng scoped endpoints và context mới trước thao tác, không mở rộng assignment từ catalogue global, không sửa deck semantics. Cần QA chứng minh unlink/disable/deck mismatch và assignment hết hạn làm request/activity/sale ngoài scope bị từ chối. M06/M07, BE-07/11 thuộc Phase E vẫn chưa đóng.

Phase phụ thuộc: BE-18/19/20 phục vụ D-FE và QA G/H; BE-14 là B/D; BE-15/16/17 giữ C/D; M06/M07 và BE-07/11 là E. Không đánh dấu Backend/DB fixed từ FE export.


### Phase E0-FE — xác minh lại ngày 25/11/2026

Giữ nguyên M06/M07/BE-07/BE-11 và BE-18/19/20, không tạo backlog trùng, không đóng finding bằng FE tests/HTTP200. BE cùng HEAD 0bc2b38; chưa có QA readiness hoặc quyền test financial mutation. Phase phụ thuộc các bổ sung dưới đây: E0/E-FE; F chỉ được triển khai phần độc lập khi giao.

| Finding ID / Priority / Blocker | File path và API | Expected / Actual / Root cause | Ảnh hưởng FE / Yêu cầu BE / Acceptance criteria |
|---|---|---|---|
| M06 / BE-01 / P1 / OPEN, BLOCKED_BY_BACKEND | payment/service/GuestPaymentExperienceService.java getLiveFolioStatement/assertAccountAccess; identity/service/RolePermissionInitializer.java; GET /payment/guest/folio/statement | Expected: owner/member/staff đúng scope, BP/cruise/account binding rõ. Actual: PASSENGER có PAYMENT_READ; helper chấp nhận PAYMENT_READ/REPORT/PROCESS trước ownership. accountId và bookingId đọc độc lập. Root cause xác minh từ source; không chạy thử IDOR trên hệ thống vận hành. | FE không gọi Folio. BE cần projection/guard xác thực owner/member với active/effective rules và response identity, xử lý mismatch/missing rõ. AC: QA primary/member/nonmember/cùng booking/khác cruise, không vượt quyền nhờ PAYMENT_READ, thiếu/mismatch context bị từ chối theo contract. |
| M07 / BE-02 / P1 / OPEN, BLOCKED_BY_BACKEND | GuestPaymentExperienceService.java khoảng580–749; GET /payment/guest/folio/statement | Expected: dữ liệu tài chính/cabin/member từ nguồn thật, thiếu account trả missing rõ. Actual: credit-limit fallback, account/member UUID ngẫu nhiên, default booking/cruise/guest, demo transactions khi không account/booking; cabin/member limits cố định cả khi account tồn tại. Root cause: nhánh synthetic còn trong service. | Không lọc demo rồi coi phần còn lại là ledger thật. BE bỏ synthetic/fallback khỏi production contract, xác nhận null vszero, currency/precision/ledger. AC: empty account/history không có sample, không tạo ID/cabin/member giả, totals đối soát đúng DB và ledger bằng QA BE cung cấp. |
| BE-07 / P1 / OPEN, BLOCKED_BY_BACKEND + NEED_BUSINESS_DECISION | payment/controller/InternationalCruisePaymentController.java; service/InternationalCruisePaymentService.java; OnboardAccount/Member/SpendingLimit/OnboardTransaction; /api/v1/onboard-accounts/{id}, /balance, /transactions; /booking/{id}/onboard-allowance | Expected: Passenger biết đúng account theo booking/BP/cruise, membership/allowance/history scope rõ. Actual: v1 GET known-ID có primary/member checks, không có Passenger discovery đã xác nhận; member read method không kiểm status/effective window. Create account dùng supplied passenger/cruise và limit, chưa thấy owner/management assertion trong method. Allowance là POS_MANAGE. Source servlet /api cộng controller /api/v1 cần chốt route deployment. | E0 không tự tạo account để discovery, không gọi POS thay Passenger. BE chốt actor tạo/đổi limit, discovery projection, active membership policy và known-ID scope; cung cấp binding IDs và QA route. AC: không arbitrary passenger account creation, không lẫn BP với Passenger ID, revoked/expired membership xử lý đúng chính sách, unknown account có code rõ, zero/unknown phân biệt. |
| M06 / BE-01 bổ sung invoice / P1 / OPEN | payment/controller/InvoiceController.java; service/InvoiceService.java; GET /invoices/{id}, /booking/{bookingId}, /onboard/{accountId} | Expected: invoice đọc đúng owner/member và GET không tạo tài liệu ngoài ý muốn. Actual: PAYMENT_READ cho Passenger được phép annotation; service read không nhận principal; booking list có auto-generation khi chưa có invoice. Root cause: read service chưa ràng actor trong đường đi đã kiểm. | Không gọi invoice như đường vòng Folio. BE xác nhận ownership/read semantics và tách generation đúng actor. AC: owner/nonowner tests, GET thiếu dữ liệu có semantics chốt, không phát hành invoice bởi Passenger ngoài quyền. |
| BE-07 bổ sung ledger / P1 / OPEN | InternationalCruisePaymentService.computeLedgerTotals; PosLedgerService.budget/history; GuestPaymentExperienceService.getLiveFolioStatement | Expected: công thức và phạm vi mỗi projection rõ. Actual: POS allowance ledger chỉ CHARGE/VOID/ADJUSTMENT POSTED, v1 còn gateway payments/refunds/reversals; negative ADJUSTMENT không có nhánh credit trong v1 loop đã đọc, Guest loop có. Root cause: nhiều pipeline khác semantics, chưa QA đối soát. | FE không cộng/trừ hoặc đổi nhãn POS remaining thành số tiền phải trả. BE chốt canonical ledger và sign/mixed currency/duplicate payment semantics. AC: dataset debit/negative adjustment/reversal/refund/partial payment đối soát mỗi projection; document account-wide vsPassenger-specific rows. |
| BE-11 / P1 / OPEN, BLOCKED_BY_BACKEND + NEED_BUSINESS_DECISION | InternationalCruisePaymentService.initiateSettlement/processSettlement; GuestPaymentExperienceService.processExpressFolioCheckout; /api/v1/settlements, /{id}/process; /payment/guest/folio/express-checkout, /security-deposit | Expected: actor/consent/time window/idempotency/recovery/payment evidence rõ. Actual: initiate auth+account read, tạo settlement mới không request key; chưa thấy explicit cruise-date gate. Process có key và terminal-state early return. Guest express phụ thuộc Folio synthetic, lưu Completed/invoice/clearance và additionalPaid nhưng chưa thấy gateway capture/charge trong method. Deposit DB/cache chưa là gateway hold proof. | Không settlement/checkout/deposit mutation hoặc CTA. BE chốt actor, exception/partial, cuối chuyến, duplicate initiate/process, gateway capture/hold/refund và clearance authority. AC: QA duplicates/timeouts/restarts/Pending/PartiallyPaid/Completed/Disputed/failed/captured/refunded và offline sync; chỉ xác nhận paid khi ledger/payment thật, không từ limit/ACTIVE/trip status/HTTP200. |

Các path trong bảng là dưới CASMS_Backend/src/main/java/com/casms/. Báo cáo chi tiết: ../mobile-phase-e0-fe/CASMS_MOBILE_PHASE_E0_API_CONTRACT.md và SETTLEMENT_READINESS. E0 chỉ formatter/state/Spending hướng dẫn quầy; không Backend/DB/RBAC changes.


### Phase F-FE — 25/11/2026

Giữ toàn bộ finding cũ, M06/M07/M08/M09/M13/M17 và BE-08…20. Các comment “BE-19” trong Java Notification là ticket Backend khác, không ghi đè FE handoff BE-19 sale recovery. Source BE vẫn0bc2b38, chưa QA readiness. Không sửa BE/RBAC/DB.

**M05 / BE-10 bổ sung — P1, OPEN / F/G:** Files notification/{controller/NotificationController,service/NotificationService,service/NotificationSseHub}.java; API GET /notifications/stream. Expected: auth/events/heartbeat/replay/proxy và producer semantics được xác nhận. Actual: Bearer/isAuthenticated, connected/notification/unread-count,30min/max3emitters, cleanup callbacks; không heartbeat/eventID/Last-Event-ID/replay trong source. notifyUser afterCommit publish, impact dispatch save Notification trực tiếp và không publish cùng đường. Root cause xác minh từ implementation in-memory hub/producer paths; proxy chưa có evidence. FE đã dùng expo/fetch sẵn có,5-attempt bounded backoff/45s idle/60s REST fallback, không POST. Yêu cầu BE: xác nhận proxy buffering/idle/authorization expiry và event publish đầy đủ; nếu cần heartbeat/replay cung cấp contract. AC: QA header auth, reconnect/refetch, duplicate/out-of-order, background/account/token switch và no leaked emitters; impact thật làm GET đổi đúng owner. Blocker: REALTIME_INTEGRATION và native/proxy QA còn BLOCKED_BY_ENVIRONMENT, không đóng M05 bằng unit tests.

## BE-21 — ACK notification cập nhật outbox quá rộng

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / Phase | BE-21 / P1 / F/G-FE |
| File path / API | CASMS_Backend/src/main/java/com/casms/notification/service/NotificationService.java acknowledgeNotification; NotificationResponse/ImpactNotificationOutboxRepository; POST /notifications/{id}/ack |
| Expected behavior | ACK đúng notification/impact/booking/cruise được chọn hoặc có bulk-account contract và consent rõ. |
| Actual behavior | Kiểm recipient của notification rồi tìm tất cả outbox chưa acknowledged của user; loop đặt ACK cho tất cả. Response chỉ readAt, không ackAt/related outbox identity. |
| Root cause | Outbox query/filter theo recipient, không ràng notification/impact được yêu cầu. |
| Ảnh hưởng FE | Không thể hiện CTA ACK một bản tin mà không xác nhận nhầm các bản tin khác. F chỉ mark read/read-all và hướng dẫn quầy; không autoACK. |
| Yêu cầu Backend | Chốt per-notification hoặc bulk semantics, bind impact identity/ownership và response ACK projection; không đổi permission FE để né. |
| Acceptance criteria | QA N1/N2 khác cruise/booking cùng user: ACK N1 chỉ ảnh hưởng đúng scope được duyệt, N2 giữ chưa ACK; read không tự ACK; idempotency/response ack state đúng, ngoài recipient404/403. |
| Blocker status | OPEN/BLOCKED_BY_BACKEND riêng ACK; Notification REST read tiếp tục. |

## BE-22 — Published itinerary change projection và notification identity

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / Phase | BE-22 / P1 / F/G-FE |
| File path / API | ship/controller/ItineraryChangeHistoryController.java; ship/service/ItineraryChangeHistoryService.java; ship/dto/response/ItineraryChangeHistoryResponse.java; notification/NotificationService/NotificationResponse; GET /itinerary-change-history/itineraries/{id}, /notifications |
| Expected behavior | Passenger chỉ thấy change được công bố, exact cruise/itinerary/day/stop/BP và safe navigation target. |
| Actual behavior | Internal history có beforeData/afterData/actor/reason nhưng không public marker trong DTO; history method đọc all rows theo itinerary. Notification chỉ BP nullable, không cruise/related entity/deep link; impact dispatch không gắn BP. Không suy title/content thành identity. |
| Root cause | Audit history khác projection công bố Passenger; notification chưa có liên kết typed entity đủ rõ. |
| Ảnh hưởng FE | F chỉ hiện schedule notification trùng BP trong selected-trip sheet; null BP ở inbox account-wide, không gán chuyến hoặc route phỏng đoán. Canonical published history bị chặn. |
| Yêu cầu Backend | Chốt publication semantics/owner projection, exact identity và route type allowlist, không yêu cầu FE tự parse before/after/nội dung. |
| Acceptance criteria | QA published/unpublished/omitted/substituted/sea-day và nhiều chuyến/BP, không lộ internal change; target mất/ngoài owner bị từ chối; event/GET consistent IDs và timestamp. |
| Blocker status | OPEN/BLOCKED_BY_BACKEND riêng canonical change history và rich entity navigation; timeline GET/public notification vẫn tiếp tục. |

## BE-23 — Push device binding chưa có contract

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / Phase | BE-23 / P2 / F/G-FE |
| File path / API | notification/controller/NotificationController.java; NotificationService/SseHub/entity/outbox; chưa thấy registration/unregister push endpoint trong source đã kiểm |
| Expected behavior | Device token bind current account/environment, permission/rotation/logout/unregister và delivery semantics rõ. |
| Actual behavior / Root cause | In-app/SSE có contract, chưa có Backend push token binding/credentials/runbook; không kết luận outbox in-app là external push delivered. |
| Ảnh hưởng FE | Không xin push permission, gửi token hoặc cài expo-notifications để giả tính năng. |
| Yêu cầu Backend | Chốt service/actor/privacy/token lifecycle/delivery/failure/retry và safe payload; cung cấp QA credentials qua kênh bảo mật. |
| Acceptance criteria | QA foreground/background/killed/denied/token rotation/account switch/logout, đúng recipient và không raw URL/PII log; package/build được duyệt riêng. |
| Blocker status | OPEN/BLOCKED_BY_BACKEND + NEED_BUSINESS_DECISION; SSE foreground độc lập. |

## BE-24 — Passenger support channel/ticket contract

| Hạng mục | Nội dung |
|---|---|
| Finding ID / Priority / Phase | BE-24 / P2 / F/G-FE |
| File path / API | notification/booking templates tham chiếu, controller search support/ticket/contact/chat; chưa xác nhận Passenger support endpoint |
| Expected behavior | Desk/contact/emergency theo ship/voyage và ticket/history/chat nếu thuộc sản phẩm, ownership/PII/status rõ. |
| Actual behavior / Root cause | Chưa có contract kênh Passenger được cung cấp; email/hotline template không chứng minh đã xác nhận cho tàu/quốc gia đang chọn. |
| Ảnh hưởng FE | F giữ direct desk/emergency guidance, không số/email/ticket/chat/success giả. |
| Yêu cầu Backend/Business | Xác nhận kênh và phạm vi service, actor/consent/recipient/status nếu có ticket/chat. |
| Acceptance criteria | QA đúng ship/voyage/owner, channel xác minh và emergency không phụ thuộc phản hồi app; nếu không có API thì chấp nhận guidance-only bằng quyết định nghiệp vụ. |
| Blocker status | OPEN/NEED_BUSINESS_DECISION riêng integration support; guidance FE sẵn sàng. |

**M15 / P2 / OPEN — F bổ sung:** PublicShipModelController/ShipModelAssetService/PublicShipModelResponse và /ships/{id}/public-model[/modelId/assets/path]. Expected: selected ship READY model, exact mapping/version/size/cache và native benchmark. Actual: endpoint public rechecks publication, model metadata và cabin mappings có, assetGLB/no-store; local reference đầy đủ ~281MB/~182MB không là publication QA. FE chỉ on-demand metadata/text, không bundle/renderGLB hoặc suy vị trí. BE/DB cần published model/mapping dataset và asset sizing/cache policy; FE/device cần benchmark memory/load/frame/dispose trước renderer. AC: wrongship/revokedmodel/assets bịtừchối, mappings thật, representative Android/iOS benchmark được review. Blocker: M15/BENCHMARK/HARDWARE/PUBLICATION_QA chưa đóng; không sửa model/DB/Web. BE-15/M17 location/area projection và permissions giữ nguyên.

**M13 / P2 / OPEN — runtime F:** SDK/ADB/Pixel_8 hiện đã tìm thấy; AVD có ExpoGo nhưng SystemUI ANR rồi Failed to download remote update khi mở local fixture. Không kết luận lỗi app/SDK bằng hiện tượng này, không đổi firewall/network/security. Cần đúng native development build/local connectivity/QA URL và profile trước real UI/stream/device gate. Không ảnh hưởng kết quả source/unit/export, không đóng finding khác.

### Phase G-FE — cập nhật M05/BE-10 và M13, 25/11/2026

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | M05 / BE-10 / P1; M13 / P2, giữ ID hiện có |
| File path | Backend notification/service/NotificationSseHub.java (chỉ đọc); Frontend src/features/notifications/{notification-stream,NotificationSync,notification-queries}; app-query-focus.ts/session-store.ts; evidence runtime G |
| API | GET /notifications/stream; GET /notifications; /notifications/unread-count; /auth/me |
| Expected behavior | Kết nối SSE không bị coi là chết chỉ vì không có business event; contract proxy/expiry/producer được xác nhận, native app có thể kết nối QA đúng scope. |
| Actual behavior | Backend source vẫn timeout30min/max3, không heartbeat/replay. G xác nhận watchdog45s của FE F gây ngắt healthy idle và đã sửa:45s handshake, established idle giữ, lease30min theo source, stable60s reset retry; bounded5 và REST60s/coalesce250ms giữ. Native/proxy/producer integration chưa nghiệm thu. AVD G boot1, ExpoGo58.0.5 Android16 x86_64; chưa thấy package CASMS dev build. Local Web HTTP000 và IAB attach timeout2 lần, chưa load product. Không kết luận tái hiện ANR F hoặc Backend lỗi từ preview failure. |
| Root cause | Lỗi FE idle được xác minh bằng source/fake-stream tests và đã source-fix. Runtime preview connectivity/tool attachment chưa xác minh root cause; no native build evidence. |
| Ảnh hưởng Frontend | Source SSE/UI hardening tiếp tục; rendered/SR/native realtime/NFC/full E2E gate còn chặn. Không có financial/journal invalidation hoặc event→POST. |
| Yêu cầu Backend / phối hợp M | Xác nhận proxy buffering/timeout/JWT expiry, impact producer→SSE và identity đúng recipient; heartbeat/replay nếu sản phẩm yêu cầu. Cấp QA URL/actor/dataset/permissions; phối hợp đúng native build/connectivity, không yêu cầu sửa business rules để FE chạy. |
| Acceptance criteria | Native QA healthy idle vượt45s không reconnect, EOF/30min rotation/refresh/background/foreground/account/API switch cleanup, max emitter không leak, GET recovery đúng owner; không replay writes/journal loss. Build runtime/UI/QR/NFC evidence riêng. |
| Blocker status | OPEN: BE-10 real integration và M13 native/runtime. FE G-01 SOURCE_FIXED không đóng Backend finding. |

Giữ M06/M07 Folio, M08 Activation, M09 QA, M15 model benchmark, M17 POS assignment và BE-08/09/14…24 cùng mọi finding cũ. G không gọi ACK BE-21, published history BE-22, push BE-23 hoặc support API BE-24; không thay Backend/DB/RBAC. UI source cải thiện không là bằng chứng đóng các finding đó.
