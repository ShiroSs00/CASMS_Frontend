# CASMS Mobile Phase F — API_CONTRACT

Ngày 25/11/2026. FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main + working tree B/C/D/E0 được giữ; BE0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc (?? qa/ từ trước). Baseline171 tests, typecheck/lint/export pass, Doctor19/20 và11 mismatch nền. Đọc AGENTS/OceVie Mobile, báo cáo0/A0/A/B/C/D/E0, handoff và source hiện tại; không dùng báo cáo thay contract. Chỉ sửa Mobile/tài liệu, không BE/DB/Web, SQL/seed/Maven, dependency mới, commit/push hoặc Folio/checkout. Áp dụng7 skill bắt buộc và frontend-testing-debugging, chi tiết SKILL_USAGE. Evidence là source/unit/contract/export trừ khi ghi rõ rendered; chưa có QA BE/DB xác nhận.

Tất cả URL dưới đây sau servlet context /api. Read request không body trừ query nêu rõ. Lỗi chung401/403/404 giữ khác missing/empty; client không tự logout403. Source thực đọc controller/service/DTO của ship/activity/notification, không suy endpoint từ tên class.

| Method / endpoint / DTO | Permission / ownership / scope | Lifecycle / errors / FE consumer / readiness |
|---|---|---|
| GET /itineraries/mine →PassengerItineraryResponse[] | BOOKING_READ; authenticated Passenger.User qua BookingPassengerRepository.findPassengerTrips | Confirmed/Cancelled booking, published itinerary OPEN_FOR_SALE/ACTIVE/COMPLETED/CANCELLED; own BP/cruise; Voyage Context/Home/Itinerary; STATIC_VERIFIED |
| GET /cruise/{id} →CruiseResponse | permitAll controller, FE chỉ selected own voyage và existing CRUISE_READ gate | cruise status/ship/name/departure/return;404; Home/Destination; no ticket mutation |
| GET /itineraries/{id} →ItineraryResponse | ITINERARY_READ hoặc CRUISE_READ; service access; FE expectedCruiseId và public status gate | không DRAFT/APPROVED chưa công bố;502 mismatch; itinerary-client; ready |
| GET /itineraries/{id}/days →ItineraryDayResponse[] | ITINERARY_READ hoặc CRUISE_READ; exact itineraryId | dayID/LocalDate/dayNumber/PORT_DAY/SEA_DAY/shipTimeZoneId; alternative /itinerary-days/by-itinerary/{id} cần DAY_READ nhưng không đổi consumer; ready |
| GET /cruise-stops/by-itinerary/{id}; /cruise-stops/{stopId} →CruiseStopResponse[]/row | CRUISE_STOP_READ hoặc CRUISE_READ hoặc ITINERARY_READ; exact itinerary/day IDs | planned/actual/allAboard/OMITTED/SUBSTITUTED; Itinerary và C excursion chain; no false replacement; ready |
| GET /itinerary-change-history/itineraries/{id}, /{historyId}, list | ITINERARY_CHANGE_READ, DTO ItineraryChangeHistoryResponse có nội bộ, chưa public marker đủ | không gọi canonical admin history cho Passenger mới; published projection thiếu BE-22 BLOCKED |
| GET /activities/registrations →RegistrationView[] | ACTIVITY_REGISTRATION + owner filtering service, C own-BP filtering | PENDING/CONFIRMED/CANCELLED/COMPLETED; Activity/Excursion registrations chung, exact target XOR; C giữ nguyên |
| GET /activities; /activities/{id}; GET /shore-excursions?cruiseStopId= | ACTIVITY_READ / EXCURSION_READ; selected cruise/stop và C fresh access | registered projection /mine còn kind ONBOARD_ACTIVITY/SHORE_EXCURSION, activityId/registrationId/quantity; omitted/substituted không đăng ký; ready theo C contract |
| GET /notifications →NotificationResponse[] | isAuthenticated, recipientUser exact, FE NOTIFICATION_READ/personal gate | UUID/BP nullable/type string/title/content/createdAt/readAt nullable; không severity/deepLink/ack flag/pagination; Notification Center/Home; strict dedupe, ready |
| GET /notifications/unread-count →{unreadCount:Long} | same recipient | không unknown→0, integer nonnegative; Center; ready |
| PATCH /notifications/{id}/read, no body →NotificationResponse | same recipient UUID lookup | idempotent readAt, unread-count SSE sau commit;404 nonrecipient; Center; ready, không ACK |
| PATCH /notifications/read-all, no body →{updatedCount:Long} | same recipient | đọc unread của account, SSE unread-count sau commit; user action only; Center; ready |
| POST /notifications/{id}/ack, no body →NotificationResponse | same recipient notification | current implementation ACK mọi user outbox chưa ACK; không ackAt/related IDs trong response; BE-21 BLOCKED, không UI trigger |
| GET /notifications/stream →text/event-stream | isAuthenticated, Bearer header; recipient user; no X-POS-Session/query JWT | connected, notification, unread-count;30min timeout/max3emitters/user, no heartbeat/ID/replay; SSE implementation F + fallback, deployed/native QA pending |
| GET /ships/{id} →ShipResponse | SHIP_READ; selected ship only | đọc tham chiếu; tên tàu hiện lấy cruise response đã xác minh, không hardcode;404; Destination |
| GET /decks/by-ship/{id} →DeckResponse[] | DECK_READ; each row.shipId exact | deck ID/name/number server; no inferred cabin deck; Destination ready |
| GET /ships/{id}/areas →ShipAreaResponse[] | SHIP_CONFIGURATION_READ, chưa mặc định Passenger được quyền | không dùng Staff/POS để bypass; activity location từ actual DTO, BE-15/M17 location projection giữ mở |
| GET /ships/{id}/public-model →PublicShipModelResponse | permitAll; operational ship + latest READY model; FE exact selected ship | modelId UUID/manifest/cabinMappings;404 notpublished; Destination on-demand metadata only; ready for text, no3D rendering |
| GET /ships/{id}/public-model/{modelId}/assets/{*assetPath} →GLB streaming | permitAll nhưng check ship/model READY/operational/public file allowlist mỗi request | contentLength, model/gltf-binary, Cache-Control no-store;404 revoked/mismatch/invalidpath; không download/bundle auto; benchmark M15 OPEN |
| Passenger support channels | chưa thấy ticket/chat/contact projection endpoint trong source đã kiểm | không tạo ticket/ID/success/contact giả; Support guidance và internal routes only; BE-24 BLOCKED riêng API |
| Push device registration | chưa thấy endpoint/token binding/rotation/unregister contract | không xin push permission/gửi token, không cài library; BE-23 BLOCKED |

Notification producers không phải enum đóng: chỉ CRUISE_SCHEDULE_CHANGE được mapping business invalidation/navigation với exact BP. Các type khác chỉ inbox/read; không parse nội dung làm route/entity. Impact dispatch hiện save Notification trực tiếp và không publish qua notifyUser, BP có thể null; fallback REST bù read freshness nhưng không sửa thiếu identity. Aggregate/dispatch cần authority quản trị, F không gọi.

File sửa/thêm xem FE_IMPLEMENTATION; tests189 hiện tại, evidence cuối FE_REGRESSION. Contract source verified khác Real API/realtime/device pass. Không đổi dependency hoặc M06/M07. Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS; ACK/published history/push/support/3D gates riêng.
