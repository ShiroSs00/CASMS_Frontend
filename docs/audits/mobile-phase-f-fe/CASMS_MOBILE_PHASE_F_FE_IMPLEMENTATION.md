# CASMS Mobile Phase F — FE_IMPLEMENTATION

Ngày 25/11/2026. FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main + working tree B/C/D/E0 được giữ; BE0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc (?? qa/ từ trước). Baseline171 tests, typecheck/lint/export pass, Doctor19/20 và11 mismatch nền. Đọc AGENTS/OceVie Mobile, báo cáo0/A0/A/B/C/D/E0, handoff và source hiện tại; không dùng báo cáo thay contract. Chỉ sửa Mobile/tài liệu, không BE/DB/Web, SQL/seed/Maven, dependency mới, commit/push hoặc Folio/checkout. Áp dụng7 skill bắt buộc và frontend-testing-debugging, chi tiết SKILL_USAGE. Evidence là source/unit/contract/export trừ khi ghi rõ rendered; chưa có QA BE/DB xác nhận.

Đã triển khai các phần F có contract: Notification REST unread/read-all, foreground SSE bằng expo/fetch hiện có, bounded retry và fallback REST; exact notification navigation; timeline Today cùng Home; xử lý ngày/stop bị xóa; metadata sơ đồ công bố đọc khi yêu cầu; Support guidance. Không viết workflow quản trị, ACK sai scope, push hoặc renderer3D.

File đọc: itinerary/{itinerary-api,itinerary-client,PassengerLiveItineraryScreen,api-format,ItineraryUI}; home/{PassengerLiveHomeScreen,PassengerDestinationScreen,voyage-home-model}; notifications/support screens; passenger-api/hooks/model/types/voyage-selection; app-query-focus/session-store/_layout; Backend ItineraryController/PassengerItineraryService/ItineraryService/ChangeHistory/Cruise/CruiseStop/Activity/ShoreExcursion, NotificationController/Service/SseHub/DTO/entity, PublicShipModelController/ShipModelAssetService/ShipController/deck DTO. WebBooking ModelCanvas/model/scene chỉ tham chiếu, không sửa. Local Model3d assets chỉ đọc metadata/GLB JSON header, không đưa vào bundle.

File sửa/thêm F (gốc CASMS_MobileApp/):

- src/app/_layout.tsx: một NotificationSync trong authenticated app tree.
- src/features/notifications/{notification-contracts.ts,notification-stream.ts,notification-queries.ts,NotificationSync.tsx}: schema/dedupe/navigation, SSE parser/controller, scoped invalidation, AppState/visibility/token lifecycle và trạng thái connection.
- src/features/notifications/PassengerNotificationsScreen.tsx: unread GET, mark-all PATCH, loading/paused/error/empty/detail, read khác ACK, exact-BP navigation và chuyển chuyến có xác nhận bằng CTA.
- src/features/passenger-actions/passenger-api.ts: reuse notification schema, unread/read-all DTO; registered activity kind/ID/quantity; deck response ship validation.
- src/features/home/voyage-home-model.ts và itinerary/PassengerLiveItineraryScreen.tsx: dùng chung itineraryToday, giữ ngày hợp lệ, cảnh báo ngày/stop mất; history chỉ notification gắn đúng BP, không admin change endpoint.
- src/features/itinerary/itinerary-client.ts: strict Passenger detail từ chối trạng thái itinerary nội bộ chưa công bố.
- src/features/home/{ship-information.ts,PassengerDestinationScreen.tsx}: validate selected ship/model/manifest/assets và chỉ đọc metadata khi bấm; không tảiGLB.
- src/features/support/PassengerSupportScreen.tsx: không ticket/chat giả, emergency/direct desk guidance và liên kết route đã có.
- tests/notification-realtime.test.mjs, tests/notification-contracts.test.mjs: thêm18 tests, giữ171 baseline; tests/fixtures/passenger-api-server.mjs bổ sung UI-only Notification/SSE/day data và configurable local port.

Root cause chính: chỉ có list/read, thiếu unread/read-all và session SSE; history cũ lấy mọi schedule notification của account làm cập nhật chuyến đang chọn; ngày default đầu tiên khác Today Home, stop biến mất có thể tự chuyển modal sang stop khác; thiếu kiểm deck/model đúngship. Sau sửa, GET luôn authoritative, event không sửa business state/không POST, payload không đủ identity không được đoán route.

189/189 tests pass ở vòng hiện tại; các check cuối FE_REGRESSION. Skill theo từng thay đổi ở SKILL_USAGE. Dependency giữ nguyên. Blocker: BE-21 ACK, BE-22 published changes/identity, BE-23 push, BE-24 support API; M05/BE-10 cần QA stream/proxy, M15 benchmark; giữ toàn finding cũ. Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS, không REALTIME_INTEGRATION_PASSED hoặc native E2E từ unit tests.
