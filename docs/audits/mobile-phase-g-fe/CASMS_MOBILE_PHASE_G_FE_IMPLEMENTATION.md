# CASMS Mobile Phase G — FE_IMPLEMENTATION

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

**UI_UX_SOURCE_READY_RUNTIME_QA_BLOCKED**. Đã triển khai các cải thiện có căn cứ, không chỉ audit.

## Files source/test thay đổi trong G

- `CASMS_MobileApp/src/constants/ocevie.ts`
- `CASMS_MobileApp/src/hooks/foreground-clock.ts`
- `CASMS_MobileApp/src/hooks/use-now.ts`
- `CASMS_MobileApp/src/features/home/PassengerDestinationScreen.tsx`
- `CASMS_MobileApp/src/features/home/VoyageHomeParts.tsx`
- `CASMS_MobileApp/src/features/notifications/notification-stream.ts`
- `CASMS_MobileApp/src/features/notifications/PassengerNotificationsScreen.tsx`
- `CASMS_MobileApp/src/features/passenger-actions/PassengerActionUI.tsx`
- `CASMS_MobileApp/src/features/passenger-actions/PassengerActivitiesScreen.tsx`
- `CASMS_MobileApp/src/features/passenger-actions/PassengerBookingScreens.tsx`
- `CASMS_MobileApp/src/features/passenger-actions/PassengerCheckInScreen.tsx`
- `CASMS_MobileApp/src/features/passenger-actions/PassengerServiceRequestsScreen.tsx`
- `CASMS_MobileApp/src/features/pos/pos-layout-metrics.ts`
- `CASMS_MobileApp/src/features/pos/pos-ui.tsx`
- `CASMS_MobileApp/src/features/pos/PosDashboard.tsx`
- `CASMS_MobileApp/src/features/pos/PosServices.tsx`
- `CASMS_MobileApp/src/components/passenger/MaterialIcon.tsx`
- `CASMS_MobileApp/src/components/passenger/OutlinedField.tsx`
- `CASMS_MobileApp/src/components/passenger/PassengerButton.tsx`
- `CASMS_MobileApp/src/components/passenger/PassengerNavigation.tsx`
- `CASMS_MobileApp/src/components/passenger/PassengerScaffold.tsx`
- `CASMS_MobileApp/src/components/passenger/PassengerSheet.tsx`
- `CASMS_MobileApp/src/components/passenger/PassengerUI.tsx`
- `CASMS_MobileApp/tests/native-ui-hardening.test.mjs`
- `CASMS_MobileApp/tests/notification-realtime.test.mjs`
- `CASMS_MobileApp/docs/ocevie-mobile-ux.md`

Danh sách hash phân biệt G với working tree trước: evidence/changed-files.json và baseline-hashes.json. Tài liệu gồm15 báo cáo, evidence, OceVie Mobile và hai handoff/backlog.

## G-01 — P1

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-01 / P1 |
| Screen/route | Toàn Passenger/NotificationSync |
| File path (dưới CASMS_MobileApp) | src/features/notifications/notification-stream.ts |
| Root cause / Before | Watchdog được gia hạn theo bytes và abort sau45s; hub không heartbeat nên kết nối khỏe cũng bị ngắt. |
| After / Proposed fix | 45s chỉ cho handshake connected; silence khỏe không abort. Lease30min theo NotificationSseHub; EOF/error reconnect; chỉ stable60s mới reset retry budget. |
| Skill applied | expo-data-fetching; impeccable optimize |
| Test evidence | notification-realtime.test.mjs: healthy idle, malformed handshake, EOF/lease, rapid close |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; BE-10 runtime còn OPEN |

## G-02 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-02 / P2 |
| Screen/route | /notifications |
| File path (dưới CASMS_MobileApp) | src/features/notifications/PassengerNotificationsScreen.tsx; src/features/passenger-actions/PassengerActionUI.tsx |
| Root cause / Before | API trả toàn hộp thư; map trong ScrollView mount tất cả hàng, không giới hạn dataset. |
| After / Proposed fix | FlatList một scroll owner, UUID key, initial12; giữ read/read-all/detail/voyage guards và trạng thái hiện có. LivePage mặc định vẫn scroll cho consumer khác. |
| Skill applied | expo-native-ui; expo-data-fetching; impeccable optimize |
| Test evidence | native-ui-hardening.test.mjs + full suite; benchmark thiết bị pending |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; large dataset/device benchmark OPEN |

## G-03 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-03 / P2 |
| Screen/route | Login/Services/POS/forms |
| File path (dưới CASMS_MobileApp) | src/constants/ocevie.ts; components/passenger/{OutlinedField,PassengerUI}.tsx; features/{passenger-actions/PassengerActionUI,pos/pos-ui}.tsx |
| Root cause / Before | Viền tương tác dùng #D5E0E4 vốn dành cho phân cách; search chỉ có placeholder mất khi nhập. |
| After / Proposed fix | Map controlBorder #718391 từ OceVie canonical; giữ divider riêng. Search có nhãn nhìn thấy; input16; focus teal. |
| Skill applied | expo-design-system; ui-ux-pro-max; frontend-design |
| Test evidence | native-ui-hardening.test.mjs kiểm contrast >=3 cho boundary, >=4.5 cho text |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; visual focus QA OPEN |

## G-04 — P1

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-04 / P1 |
| Screen/route | Các picker Passenger/POS |
| File path (dưới CASMS_MobileApp) | src/features/passenger-actions/PassengerActionUI.tsx: Choice |
| Root cause / Before | Trigger disabled nhưng options trong sheet đã mở vẫn bấm được; tên accessible không chứa giá trị đã chọn. |
| After / Proposed fix | Options disabled và guard handler khi pending; nhãn trigger gồm label + selected label; không đổi choice/business state khi khóa. |
| Skill applied | expo-native-ui; impeccable harden |
| Test evidence | typecheck/lint; C/D journal + session tests; interaction native chưa chạy |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; rendered busy-toggle QA OPEN |

## G-05 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-05 / P2 |
| Screen/route | Mọi PassengerSheet |
| File path (dưới CASMS_MobileApp) | src/components/passenger/PassengerSheet.tsx; MaterialIcon.tsx |
| Root cause / Before | Backdrop là một nút screen reader trùng Close; icon chỉ có web aria-hidden; keyboard Android chưa có avoidance behavior. |
| After / Proposed fix | Backdrop decorative, Close48px vẫn dùng được; native icon hidden; sheet top inset và Android height avoidance, scroll keyboard insets. Giữ pending dismissal lock/exit snapshot. |
| Skill applied | expo-native-ui; impeccable accessibility/adapt |
| Test evidence | existing sheet-presence tests; typecheck/export; keyboard/SR native pending |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; rendered keyboard/focus OPEN |

## G-06 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-06 / P2 |
| Screen/route | /staff-pos; /staff-pos/requests |
| File path (dưới CASMS_MobileApp) | src/features/pos/{pos-ui,PosDashboard,PosServices}.tsx; pos-layout-metrics.ts |
| Root cause / Before | POS bị giới hạn600px như Passenger; thao tác/detail tuần tự dù có nhiều chiều rộng. |
| After / Proposed fix | Dashboard context/work hai pane; Request details/actions hai pane khi available width/fontScale >=840. Phone/chữ lớn một cột. Forms/scanner/statement giữ600. Không tạo route/API hoặc bỏ xác nhận. |
| Skill applied | expo-design-system; impeccable adapt; ui-ux-pro-max |
| Test evidence | posColumns unit:320/375/430/768/840/1024/1280, font1.3/1.5/2; POS full regressions |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; tablet render OPEN |

## G-07 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-07 / P2 |
| Screen/route | /home; Passenger tabs |
| File path (dưới CASMS_MobileApp) | src/features/home/VoyageHomeParts.tsx; components/passenger/PassengerNavigation.tsx; PassengerScaffold.tsx |
| Root cause / Before | Cột giờ cố định46 có thể cắt chữ tăng cỡ; thông tin tàu/ngày/cabin12–13; tab label không có maxWidth. |
| After / Proposed fix | Cột giờ intrinsic; facts/body dùng typeScale.body15; summary dùng radius/spacing shared. Tab text giới hạn chiều rộng của tab và wrap; heading minWidth0. |
| Skill applied | frontend-design; expo-design-system; impeccable polish |
| Test evidence | typecheck/lint/export; Today/timezone tests giữ; Dynamic Type render pending |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; scaled UI QA OPEN |

## G-08 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-08 / P2 |
| Screen/route | /check-in; /cruise; bookings; services; activities |
| File path (dưới CASMS_MobileApp) | src/features/passenger-actions/{PassengerCheckInScreen,PassengerBookingScreens,PassengerServiceRequestsScreen,PassengerActivitiesScreen}.tsx; features/home/PassengerDestinationScreen.tsx |
| Root cause / Before | isPending cũng đúng khi query paused/disabled; có màn hiện spinner đang tải khi thực tế chưa fetch. |
| After / Proposed fix | Spinner dùng isLoading; các read chính có lời nhắc chờ kết nối. Booking empty chỉ sau isSuccess. Không mở nút ghi hoặc đổi điều kiện submit. |
| Skill applied | expo-data-fetching; impeccable harden |
| Test evidence | full contract tests/typecheck; offline rendered pending |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; offline device QA OPEN |

## G-09 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-09 / P2 |
| Screen/route | Home/Itinerary/QR/POS clocks |
| File path (dưới CASMS_MobileApp) | src/hooks/use-now.ts; foreground-clock.ts |
| Root cause / Before | Interval hiển thị chạy cả khi AppState background; mỗi consumer vẫn giữ timer. |
| After / Proposed fix | Dừng display interval ở background/inactive; tick ngay khi active; cleanup listener/timer và guard late ticks. Session expiry timer/Date.now mutation checks giữ nguyên. |
| Skill applied | impeccable optimize; expo-native-ui |
| Test evidence | 2 foreground-clock tests trong native-ui-hardening.test.mjs; expiry/journal full regression |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | SOURCE_FIXED; battery/FPS benchmark OPEN |

## G-10 — P1

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-10 / P1 |
| Screen/route | Tất cả route thực tế |
| File path (dưới CASMS_MobileApp) | evidence/runtime-inventory.txt; android-runtime.txt; browser-runtime.txt |
| Root cause / Before | Runtime F chưa load product. G AVD boot được, ExpoGo58.0.5; không có CASMS dev-client package. IAB webview attach timeout2 lần; localhost preview probe HTTP000. |
| After / Proposed fix | Đã phân loại SDK/ADB có, runtime hiện chưa đủ product UI. Không kết luận source lỗi/Backend lỗi từ lỗi kết nối. Helpers đã đóng; runbook Phase M trong runtime report. |
| Skill applied | frontend-testing-debugging; expo-native-ui |
| Test evidence | logs thực tế, không screenshot giả |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | OPEN: RENDERED_UI_BLOCKED / Phase M |

## G-11 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-11 / P2 |
| Screen/route | Performance toàn Mobile |
| File path (dưới CASMS_MobileApp) | hooks; notifications; pos; dist/phase-g |
| Root cause / Before | Chưa có startup/FPS/memory trace hoặc dataset lớn. Source timers/list đã xác minh, chưa chứng minh jank cụ thể ở các list khác. |
| After / Proposed fix | Chỉ sửa timer/list/SSE có bằng chứng. Ghi bytes artifact nếu export xong; không phần trăm cải thiện hoặc blanket memo/virtualization. |
| Skill applied | impeccable optimize; expo-design-system |
| Test evidence | verification.json / bundle-metrics.json; device benchmarks NOT_RUN |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | OPEN: representative hardware/dataset |

## G-12 — P2

| Trường | Nội dung |
|---|---|
| Finding ID / Priority | G-12 / P2 |
| Screen/route | Native Back/landscape |
| File path (dưới CASMS_MobileApp) | app.json; src/app/(passenger)/_layout.tsx |
| Root cause / Before | App đã khóa portrait và predictiveBackGestureEnabled=false. Không có native Back/rotation/focus test. |
| After / Proposed fix | Giữ cấu hình, không tự thay native build. Passenger tabs backBehavior history; sheet onRequestClose/pending guard vẫn còn. Landscape native N/A theo config hiện tại. |
| Skill applied | expo-router; impeccable adapt |
| Test evidence | source static; hardware Back NOT_RUN |
| Rendered evidence | RENDERED_UI_BLOCKED; không ảnh mới |
| Blocker / Acceptance status | OPEN: Phase M native acceptance |
