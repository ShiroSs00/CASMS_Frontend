# CASMS Mobile Phase G — PASSENGER_UI_UX_AUDIT

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Audit toàn bộ Passenger routes và subscreen, không giới hạn Phase F; mapping đầy đủ ở SCREEN_INVENTORY. Không phát hiện P0 mới qua source; điều này không phải bằng chứng không có lỗi native. Các blocker P0 Folio cũ giữ OPEN.

| Nhóm | Current behavior / positives | Issue / treatment |
|---|---|---|
| Auth/restore | Hydration trước landing, nội bộ deep-link allowlist, password manager | G-03/05; login/recovery/restore không rewrite |
| Home | Voyage trước quick actions, no giant hero, real cabin/ship/Today/next | G-07/09; mở selected voyage rõ, không hình tàu giả |
| Itinerary | Published cruise guard, timezone/Today/exact IDs; port/sea/actual/planned | G-05/09; rich history vẫn BE-22, không parse content |
| Services | Catalogue chung được ghi rõ; schedule theo cruise, requests/history/recovery | G-03/04/08; giữ charge/quota/operation journal |
| Activities/packages | Confirm/register/cancel/My registrations; purchased entitlement server | G-04/08; giá/remaining null không zero; package writes không mở |
| Check-in/QR | Conditions, emergency contact, server claim/expiry/renewal/quiet zone | G-05/08/09; QR scan vẫn cần physical device |
| Notifications | Unread explicit text, count authoritative, detail/read-all, typed BP navigation | G-01/02/05; ACK blocked, no raw URL route |
| Account/booking | Existing booking/profile/switch/logout confirm, ticket payment riêng | G-04/05/08; không nhầm ticket payments với onboard Folio |
| Spending/support | E0 state guidance, desk/emergency/account help; no fabricated contact | M06/M07/BE-24 còn OPEN; no chat/ticket/success giả |

Impeccable native audit theo source: Accessibility2/4, Performance2/4, Theming3/4, Platform conformance2/4, Adaptivity2/4 =11/20 (coverage nguồn, không điểm nghiệm thu rendered). Thiếu native SR/keyboard/gesture/FPS và tablet evidence giới hạn điểm. Verdict native conformance: CHƯA NGHIỆM THU. Existing portrait/light là declared scope; không ép dark/landscape vào G.

Ưu tiên xử lý: G-01/G-04 → G-03/05/08 → G-06/07/09, rồi polish khi có runtime. Không thay toàn bộ navigation để đạt hình thức native.

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
