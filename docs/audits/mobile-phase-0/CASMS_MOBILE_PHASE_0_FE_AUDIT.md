# Audit Frontend Mobile

Ngày rà soát 24/11/2026. FE HEAD 3c01db0 và BE HEAD 0bc2b38, xác minh trực tiếp trong workspace.

Kết luận ghi theo source hoặc mức bằng chứng trong [Báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md). Dấu vết có sẵn được phân biệt với lần chạy hiện tại.

## Baseline và cấu trúc

npm (`package-lock.json`), app 1.0.0, Expo ~58.0.23, React 19.3.0, React Native 0.88.1, Router ~58.0.30, TypeScript ~6.0.3. 127 file trong src được kiểm kê. Spring Boot 3.3.4, Java 21, PostgreSQL 16 QA, Flyway V140.

`src/app` chứa route wrappers, `(passenger)` và `staff-pos`. Feature gồm auth, home, itinerary, passenger-actions, pos, staff-pos, notifications, services, support, launch. `src/lib/api/api-client.ts` dùng fetch có AbortController timeout 20s, hỗ trợ raw JSON và ApiResponse envelope. Zustand lưu session/selection, TanStack Query quản lý cache, Zod validate nhiều DTO. Một số array adapter chỉ kiểm UUID và cast TypeScript, nên chưa bảo đảm đầy đủ schema runtime.

`session-store.ts` dùng SecureStore native, web chỉ memory, refresh bằng access JWT còn hiệu lực qua /auth/refresh. Đây là contract Backend hiện tại. Logout clear token/cache, cleanup POS bằng token cũ. Generation guard ngăn kết quả login/refresh cũ đổi owner. Query keys chứa URL và owner. `passenger-hooks.ts` xác minh /auth/me và role chỉ PASSENGER trước request. Root Stack chưa tập trung guard, LivePage và POS layout thực hiện guard tại surface. Cold start/deep-link vẫn cần test thiết bị.

`passenger-bookings/new.tsx` đã redirect về danh sách, không còn tạo booking. Các fixture trong tests không chứng minh có mock trong production. Màn legacy và route alias cần inventory trước khi xóa. Không đủ bằng chứng để kết luận mọi file legacy là dead code.

## Kết quả validation

Typecheck và lint exit 0. Unit 98/98. Web export exit 0, 36 static routes. Kiểm dependency offline exit 0 nhưng chính CLI cảnh báo độ tin cậy hạn chế. Expo Doctor chưa cài, không tải dependency trong Phase 0.

## M01 — Hủy booking (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/passenger-actions/passenger-api.ts:149` |
| Class/function | `async cancelBooking` |
| Kỳ vọng | Backend yêu cầu cancellation case khi workflow bật. |
| Thực tế | Mobile POST /booking/{id}/cancel và chờ Cancelled, backend mặc định trả 409 CANCELLATION_CASE_REQUIRED. |
| Nguyên nhân | Adapter giữ luồng legacy. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | REDIRECT_TO_WEB, Phase A |
| Khuyến nghị | Điều hướng về đúng booking trên Web sau khi xác nhận phạm vi nghiệp vụ, xử lý deep link cũ. |
| Acceptance criteria | Không còn gọi cancel legacy từ Mobile, test 409 và đường quay lại thành công. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M04 — Chi tiêu Passenger (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/app/spending.tsx:6` |
| Class/function | `SpendingRoute` |
| Kỳ vọng | Xem tài khoản/chi tiêu của mình. |
| Thực tế | Chỉ hướng dẫn xem tại quầy và chuyển sang booking/payment. |
| Nguyên nhân | Chưa có adapter folio dành riêng Passenger. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | BACKEND_CHANGE_REQUIRED, Phase E |
| Khuyến nghị | Sửa M06/M07 trước, tách hạn mức nội bộ với tiền quyết toán. |
| Acceptance criteria | Số dư/transaction đối chiếu DB, không dùng số giả hoặc quyền staff. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M05 — Realtime (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/notifications/PassengerNotificationsScreen.tsx:15` |
| Class/function | `PassengerNotificationsScreen` |
| Kỳ vọng | Thông báo cập nhật khi foreground, reconnect và đồng bộ lại inbox. |
| Thực tế | Có list/read và refresh, chưa stream/unread-count/read-all/ack. Không có expo-notifications. |
| Nguyên nhân | Chưa tích hợp SSE/push. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | IMPLEMENT, Phase F |
| Khuyến nghị | Tạo lifecycle SSE với Authorization, backoff, logout cleanup. Quyết định push riêng. |
| Acceptance criteria | Foreground/reconnect nhận thay đổi, app đóng có chiến lược push được kiểm thử riêng. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M09 — QA migration (P2)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/tests/integration/start-backend.ps1:13` |
| Class/function | `spring.flyway.enabled=false` |
| Kỳ vọng | QA khởi tạo bằng migration thật, validate schema. |
| Thực tế | Script dùng ddl-auto=update và tắt Flyway. Test hardcode 18080 và identity seed cũ. |
| Nguyên nhân | Harness QA cũ. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | FIX, Phase H |
| Khuyến nghị | Tham số hóa QA URL, dùng schema V140 và seed tương thích. |
| Acceptance criteria | Luồng thật chạy trên DB riêng, Flyway validate=true, không tăng quyền Passenger. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M10 — Danh sách dài (P2)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/notifications/PassengerNotificationsScreen.tsx:41` |
| Class/function | `inbox.data?.map` |
| Kỳ vọng | Inbox lớn có virtualization hoặc pagination. |
| Thực tế | Render tất cả bằng map trong LivePage ScrollView. |
| Nguyên nhân | Danh sách không giới hạn trong screen. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | FIX, Phase G |
| Khuyến nghị | Dùng list có virtualization và API pagination nếu cần. |
| Acceptance criteria | Đo scroll 1000 thông báo trên thiết bị, không mất focus hoặc trạng thái đọc. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M12 — Token và primitive (P2)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/components/passenger/PassengerButton.tsx:23` |
| Class/function | `borderRadius: 14` |
| Kỳ vọng | Giá trị primitive theo token Mobile đã thống nhất. |
| Thực tế | Radius 14 lặp inline/stylesheet, ripple literal, nhiều theme files. |
| Nguyên nhân | Token Mobile chưa bao phủ đầy đủ primitive. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | FIX, Phase G |
| Khuyến nghị | Hợp nhất semantic mapping trong OceVie Mobile, giữ API component. |
| Acceptance criteria | Button/Field/Sheet dùng token, kiểm contrast/disabled/text scaling thực tế. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |



## Kiểm kê kiến trúc trên HEAD

| Phạm vi | Bằng chứng và đánh giá |
|---|---|
| Routes | `src/app/_layout.tsx` nối Query provider, restore và AppState. `src/app/(passenger)/_layout.tsx` và `src/app/staff-pos/_layout.tsx` phân luồng. `passenger-bookings/new.tsx` chuyển về danh sách. Tài liệu navigation vẫn mô tả draft creation và cần cập nhật. |
| Feature và primitive | `features/auth`, `home`, `passenger-actions`, `itinerary`, `notifications`, `pos` có screen và adapter. `components/passenger` cung cấp Scaffold, Button, Sheet, Navigation, Field và list item. `features/staff-pos` chứa adapter cũ cho staff, tách với terminal runtime `features/pos`. |
| State và lifecycle | `session-store.ts:55` giữ auth Zustand và SecureStore native. `voyage-selection.ts` khóa lựa chọn theo owner/phiên. `query-client.ts` mặc định stale 30 giây và `app-query-focus.ts` nối foreground. Mutations Passenger không replay tự động và invalidate theo owner/backend. |
| API và schema | `lib/api/api-client.ts` xử lý base URL, Bearer, envelope/raw, 401 và network. Zod chặt ở auth/POS/booking projections, một số adapter dịch vụ/hoạt động dựa trên kiểu TS và kiểm ID ở lớp danh sách. |
| Loading, error, empty | Các màn live dùng query state và nút thử lại, phân biệt dữ liệu rỗng. POS giữ journal sale khi kết quả chưa rõ. Cần nghiệm thu chuyển mạng, cold start offline và background khi form mở. |
| Hằng số, test, docs | `constants/ocevie.ts`, `passenger-light-theme.ts`, `motion.ts` chứa token. `hooks` gồm now/theme/color-scheme. `types/styles.d.ts` khai báo styles, DTO đặt gần feature. Fixture itinerary và service guide nằm trong tests; tên tài liệu `temporary-passenger-api.md` và SQL quyền tạm phục vụ lịch sử QA. |
| Env và build | `.env.example` khai báo URL công khai. Cần đặt URL QA/release riêng cho native. `app.json` cấu hình Router, Splash, SecureStore, Camera. SDK 58, RN 0.88.1, React 19.3.0 và camera ~58.0.14 khớp dòng SDK theo [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) và [Expo Camera](https://docs.expo.dev/versions/v58.0.0/sdk/camera/). |

## M14 — Tài liệu và entry point cũ (P2, FE)

`CASMS_MobileApp/docs/ocevie-mobile-ux.md:10` mô tả tạo draft và ẩn các route check-in, QR, spending, trong khi `src/app/passenger-bookings/new.tsx` redirect và `src/features/auth/PassengerAccountScreen.tsx:32` liên kết spending. Tài liệu còn theo trạng thái trước khi app thành companion. Phase A/G cập nhật mô tả theo route graph và xác nhận adapter cũ còn caller trước khi dọn. Acceptance là mỗi mục tài liệu truy được tới route thực và test guard hiện có vẫn pass. Bằng chứng source và 98 test Mobile, gồm test cấm đưa purchase CTA trở lại.

## M16 — Cấu hình API khi static export (P2, FE)

`CASMS_MobileApp/src/lib/api/index.ts:5` gọi `resolveApiUrl` tại `api-client.ts:19`. Export không nạp dotenv và thiếu `EXPO_PUBLIC_API_URL` tạo bundle Android/iOS nhưng fail khi render tĩnh route check-in. Nguyên nhân là route gọi query scope khi render và fallback dev host không áp dụng lúc export. Phase G khai báo URL theo profile build và kiểm env trước export. Acceptance là export có endpoint đúng môi trường, thiếu config báo lỗi rõ trong CI trước đóng gói. Lần thử có URL loopback được ghi ở báo cáo kiểm thử.

### Bằng chứng bổ sung cho M09

`CASMS_MobileApp/tests/integration/seed-asian-voyage.sql:21` ghi `Ship.status=ACTIVE` trong transaction. PostgreSQL QA trên V140 báo `ck_ship_lifecycle_status` và psql exit 3. `CASMS_Backend/src/main/resources/db/migration/V74__ship_operational_lifecycle.sql:11–13` chuyển giá trị cũ và giới hạn enum. Ưu tiên P2, FE/BE phối hợp ở Phase H. Cập nhật fixture theo migration, seed thành công trên cluster mới và xác minh login đúng seed identity trước mọi test mutation.
