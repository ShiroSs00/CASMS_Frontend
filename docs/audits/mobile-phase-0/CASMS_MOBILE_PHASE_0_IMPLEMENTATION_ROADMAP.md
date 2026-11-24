# Roadmap Mobile Phase A–H

FE `3c01db0`, BE `0bc2b38`. Phase 0 lập kế hoạch. A ổn định danh tính và ngữ cảnh chuyến. B/C chuẩn bị dữ liệu hành khách và luồng tác nghiệp cho D. E phụ thuộc ledger và scope từ A/D. F/G có thể kiểm source và chuẩn bị QA song song khi contract ổn định. H xác nhận chuỗi hoàn chỉnh trên QA riêng và thiết bị thật.

## Phase A — Authentication & Voyage Context

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-router, expo-data-fetching, expo-design-system |
| FE tasks | Xác nhận role landing, restore/expiry, selection nhiều booking. Xử lý CTA hủy legacy theo quyết định Web. Đồng bộ tài liệu route. |
| BE tasks | Chốt M08 với Booking/Identity, trả trạng thái kích hoạt và thông tin voyage chính xác. Chốt case read hoặc chuyển Web. |
| API phụ thuộc | /auth/login, /auth/refresh, /auth/me, /itineraries/mine, /booking, /booking/{id}/cancellations |
| Database phụ thuộc | User, Passenger, BookingPassenger, CabinAssignment, CancellationCase, email QA |
| File dự kiến thay đổi | FE session-store.ts, voyage-selection.ts, PassengerBookingScreens.tsx. BE AuthService.java, BookingEmailService.java, ItineraryController.java |
| Test cases | Chưa kích hoạt → kích hoạt Web → login. Thử hết hạn, logout, nhiều chuyến/cabin và direct cancellation bị thay bằng case. |
| Acceptance criteria | Người dùng vào đúng role và chuyến. Trạng thái đặt chỗ đồng nhất với Web. |
| Exit gate | Handoff thực và fixture QA nhiều chuyến pass. Quyết định hủy được ghi nhận. |
| Blockers | Chính sách bàn giao credential và điểm đặt action hủy. |

## Phase B — Check-in & Passenger Identity

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-native-ui, expo-router, expo-data-fetching, Expo development build docs |
| FE tasks | Nối trạng thái check-in đã chốt, QR từ claim. Scanner xác minh preview, hỗ trợ confirm và thông báo trạng thái cấp. |
| BE tasks | Chốt hành vi cấp lại/mất thẻ và projection trạng thái đã cấp trước khi thêm endpoint. Giữ guard hiện có. |
| API phụ thuộc | /checkin/passenger/{id}/status, start, complete, card-claim; /pos/passenger-cards/preview, confirm |
| Database phụ thuộc | BookingPassenger, CruiseCheckin, PassengerCardClaim, PassengerNfcCard, V138 |
| File dự kiến thay đổi | FE PassengerCheckInScreen.tsx, passenger-qr.tsx, PosScanner.tsx, app.json. BE PassengerCardController.java, PassengerCardService.java, ios/PassengerCardPOS |
| Test cases | Emergency contact optional, claim hết hạn, đã cấp, sai chuyến và camera quyền denied. Thẻ QA trên thiết bị thật. |
| Acceptance criteria | Tên khách và trạng thái đúng giữa Passenger và POS; chỉ cấp một lần theo nghiệp vụ. |
| Exit gate | Claim/preview/confirm qua QA, thiết bị Android/iOS và quyết định phạm vi check-in. |
| Blockers | Kênh check-in, native NFC/config plugin và thẻ/thiết bị test. |

## Phase C — Passenger Onboard Services & Activities

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-data-fetching, expo-native-ui, ui-ux-pro-max |
| FE tasks | Chuẩn hóa quota/snapshot/slot, đưa quyền lợi vào màn tương ứng, giữ recovery và cách hiển thị lỗi. |
| BE tasks | Đối chiếu schedule/capacity/entitlement và sửa fixture theo migration. Chốt quyền chỉnh assignment draft. |
| API phụ thuộc | /servicepackage/services, /requests, /requests/by-operation-key, /activities/registrations, /shore-excursions, fare-entitlement |
| Database phụ thuộc | ServiceRequest, ServiceSchedule, ServiceUsage, ActivityRegistration, PackageAssignment, Entitlement |
| File dự kiến thay đổi | FE PassengerServiceRequestsScreen.tsx, PassengerActivitiesScreen.tsx, PassengerPackagesScreen.tsx, passenger-api.ts. BE ServiceRequestService.java, ActivityController.java |
| Test cases | Slot hết, miễn phí/có phí, quota cạn, retry sau timeout, sửa/hủy đăng ký, excursion theo cảng. |
| Acceptance criteria | Kết quả và số chỗ phản ánh dữ liệu thật, retry giữ cùng thao tác. |
| Exit gate | Chuỗi Passenger request/registration persisted pass và quyền lợi khớp ledger. |
| Blockers | Schema fixture, dữ liệu slot/capacity theo thời điểm và quyết định chỉnh draft. |

## Phase D — Staff POS Operations

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-data-fetching, expo-native-ui, Expo Camera/development builds docs |
| FE tasks | Hoàn thiện tra thẻ sau B, kiểm UI accept/reject/fulfill, usage, registration/attendance, pending sale và hết phiên. |
| BE tasks | Xác minh terminal/area assignment, lifecycle service và activity, ledger sale và idempotency. |
| API phụ thuộc | /pos-terminals/{id}/sessions, /pos/session, /pos/services, /pos/requests, /pos/activities, /pos/sales, /pos/passenger-cards/lookup |
| Database phụ thuộc | PosTerminal, PosSession, area/service & activity assignment, ServiceUsage, OnboardTransaction |
| File dự kiến thay đổi | FE PosLayout/PosServices/PosActivities/PosUsage/PosScanner, pos-transport.ts, pos-storage.ts. BE PosController.java, PosActivityController.java, PosService.java |
| Test cases | Đúng/sai thiết bị, terminal và area, hết phiên, accept/reject/fulfill, attendance, sale retry. |
| Acceptance criteria | Nhân viên thao tác đúng context, Passenger đọc trạng thái mới, một giao dịch cho một ý định. |
| Exit gate | Regression QA POS và kết quả luồng cross-app; lookup xác nhận trên phần cứng. |
| Blockers | Assignment QA, thẻ NFC và policy xử lý mất thẻ. |

## Phase E — Onboard Spending & Settlement

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-data-fetching, expo-native-ui, PostgreSQL/Flyway docs |
| FE tasks | Thêm folio có trạng thái theo account, booking/passenger allowance, history và tổng. Chỉ đưa invoice/settlement/checkout đã được duyệt. |
| BE tasks | Xử lý M06/M07, chuẩn hóa hợp đồng folio theo ownership/ledger, tách tiền vé, chốt invoice và settlement. |
| API phụ thuộc | /payment/guest/folio/statement, /booking/{id}/onboard-allowance, POS statement; checkout/settlement theo quyết định |
| Database phụ thuộc | OnboardAccount, SpendingLimit, OnboardTransaction, SettlementStatement, invoice |
| File dự kiến thay đổi | FE spending.tsx, passenger-api.ts, pos-contracts.ts. BE GuestPaymentExperienceService.java, PosLedgerService.java, InternationalCruisePaymentController.java |
| Test cases | Folio trống, sai context, allowance đủ/thiếu, currency/decimal, sale và hoàn tác, checkout lặp. |
| Acceptance criteria | Tổng và số dư khớp ledger; người dùng chỉ thấy dữ liệu được cấp. Thiếu context có lỗi rõ ràng. |
| Exit gate | BE contract owner/ledger và E2E sale → Passenger statement → checkout QA pass. |
| Blockers | Contract folio M06/M07 và lựa chọn settlement actor/payment. |

## Phase F — Itinerary, Realtime & Support

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-router, expo-data-fetching, expo-native-ui |
| FE tasks | Nối unread/read-all, SSE foreground với resume/backoff/teardown, cập nhật lịch trình. Đánh giá deck/map & 3D và kênh hỗ trợ. |
| BE tasks | Chốt event/reconnect, dữ liệu port time và support. Xác nhận public model/deck metadata và caching. |
| API phụ thuộc | /itineraries/{id}/days, stops/history, /notifications/stream, unread-count, read-all, ack, /ships/{id}/public-model |
| Database phụ thuộc | ItineraryDay, CruiseStop, history, Notification, ShipModel/Deck/Area |
| File dự kiến thay đổi | FE itinerary-client.ts, PassengerNotificationsScreen.tsx, _layout.tsx, PassengerSupportScreen.tsx. BE NotificationController.java, PublicShipModelController.java |
| Test cases | Đổi lịch giữa múi giờ, SSE mất mạng/resume/logout, mở thông báo và ACK; test model trên thiết bị nếu chọn tích hợp. |
| Acceptance criteria | Một connection theo phiên active, khi reconnect dữ liệu REST hội tụ và thời gian cảng chính xác. |
| Exit gate | QA update/notification pass. Phạm vi push, hỗ trợ và 3D có quyết định. |
| Blockers | Event contract, proxy idle, kênh hỗ trợ, mapping model/độ lớn asset. |

## Phase G — Native UI/UX & Performance

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-native-ui, expo-design-system, ui-ux-pro-max, impeccable native audit |
| FE tasks | Chuẩn hóa primitive/token hiện có, touch target, keyboard/sheet, reduced motion, adaptive POS/tablet và danh sách dài. |
| BE tasks | Cung cấp dataset nhiều bản ghi và các trạng thái để đo. Xác nhận pagination nếu contract cần. |
| API phụ thuộc | Dùng contract A–F, đo loading/empty/error/offline bằng backend QA. |
| Database phụ thuộc | Dataset nhiều booking/service/activity/transactions; trace không chứa dữ liệu khách thật |
| File dự kiến thay đổi | FE PassengerScaffold.tsx, PassengerNavigation.tsx, PassengerSheet.tsx, PassengerButton.tsx, PosLayout.tsx và app.json |
| Test cases | 320–375dp, large text, TalkBack/VoiceOver, hardware Back, tablet và cuộn danh sách. Đo cold start/frames. |
| Acceptance criteria | Màn có label/trạng thái, focus tin cậy, CTA không che và thời gian phản hồi đạt ngưỡng QA thống nhất. |
| Exit gate | Nghiệm thu thiết bị Android/iOS, tablet POS và kiểm tra regression export. |
| Blockers | Thiết bị/cấu hình build, dataset và ngưỡng hiệu năng. |

## Phase H — Full Mobile Functional E2E

| Hạng mục | Công việc |
|---|---|
| Skill/tài liệu | expo-router, expo-data-fetching, Expo Build docs; Spring Boot/PostgreSQL QA |
| FE tasks | Chạy 13 luồng qua development build và lưu bằng chứng theo bước; giữ smoke cho login/logout, resume và navigation. |
| BE tasks | Migrate QA sạch, seed tài khoản độc lập, chuẩn bị log correlation và quy trình dọn fixture. |
| API phụ thuộc | Contract A–G, runner cấu hình base URL và artifact đã che dữ liệu. |
| Database phụ thuộc | PostgreSQL QA riêng, lịch sử Flyway, nguồn seed mới và hồ sơ Web-to-Mobile |
| File dự kiến thay đổi | Mobile tests/integration và docs/real-api-qa.md. BE PosPostgresIntegrationTest.java, FlywayMigrationPostgresIntegrationTest.java, QA fixture |
| Test cases | Web booking/payment/activation, Passenger login/context/itinerary/catalog/request, POS fulfillment, Passenger refresh, registration, sale, statement, notification, logout. |
| Acceptance criteria | Mọi thao tác chính có phản hồi API và bằng chứng DB trên đúng QA. |
| Exit gate | Có báo cáo pass/fail và lỗi P0/P1 đã xử lý hoặc có quyết định release. |
| Blockers | Fixture cũ, thiết bị, test account và các quyết định A–G. |
