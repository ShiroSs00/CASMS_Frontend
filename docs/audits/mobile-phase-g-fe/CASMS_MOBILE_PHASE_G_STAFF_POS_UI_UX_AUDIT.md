# CASMS Mobile Phase G — STAFF_POS_UI_UX_AUDIT

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Audit toàn bộ Staff POS, kể cả state không có route riêng; không dùng Web để bypass PosLayout.

| Flow / route | Behavior / nguyên tắc giữ | UX finding / fix | Evidence |
|---|---|---|---|
| Employee login /login | Role + auth/me current owner gate | Shared Field/Button contrast và disabled semantics | G-03/04; source/contract |
| Device auth/terminal/session /staff-pos | POS credential riêng; list khi POS_MANAGE, manual ID nếu không có discovery | 600px bounded form; M17/BE-18 không được né quyền | PosLayout source, D tests |
| Dashboard /staff-pos | Terminal/user/ship/cruise/queue, close/logout confirm | G-06 hai pane context/work; context không bị bỏ | Unit responsive; rendered OPEN |
| Services /staff-pos/services | Search/filter/price theo grant | Shared Field boundary/keyboard; không mua product mới | G-03/05 |
| Requests/detail /staff-pos/requests | Search/status/owner, accept/reject/start/full fulfillment | G-06 detail/action panes, caption terminal/user | POS lifecycle/fulfillment tests |
| Fulfillment sheet | Full quantity/unit/entitlement preflight | Disabled Choice trong busy state; sheet keyboard | G-04/05; no lifecycle change |
| Activities/detail /staff-pos/activities | Registration/create/edit/cancel/confirm/attendance/current Activity | Shared input/choice/sheet, no step removed | D/current full suite |
| Scanner/QR/NFC /staff-pos/scanner | Permission + focus/AppState camera; preview then confirm/lookup | Keep teardown; Go/Web NFC unavailable guidance | B tests; hardware OPEN |
| Sale /staff-pos/usage | Separate new sale from fulfillment; preflight/currency/price | Keep600px form, confirm protects identity; G shared improvements | Sale/journal/session tests |
| Receipt/recovery | Pending durable scope, explicit same-key reconcile | Không reset journal khi bố cục/đóng sheet; blocked cross-session context remains | pos-operations/session-cleanup |
| Allowance/statement | Staff account-wide read theo scoped endpoint | AmountRow tabular/unknown/currency, no Passenger Folio substitution | E0/D regression |
| Session close/logout | Server close acknowledgment trước clearing | Existing confirmation/pending lock preserved | D close tests |

Không đo thời gian hoàn thành tác vụ/số tap trên native vì app chưa render. Source flow vẫn giữ các bước xác nhận đã có; không claim giảm thời gian/tap. Phone/tablet source có tiến bộ, chưa TABLET_UI_PASSED. Back/rotation: portrait-only; native landscape không thuộc cấu hình hiện tại.

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
