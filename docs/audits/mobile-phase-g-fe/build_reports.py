"""Build Phase G's Vietnamese source-review reports from local evidence only."""
from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / 'CASMS_MobileApp'
OUT = Path(__file__).resolve().parent
EV = OUT / 'evidence'
PREFIX = 'CASMS_MOBILE_PHASE_G_'
BASE = 'Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.\n\n'
LIMIT = 'Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.\n\n'

def write(name, body):
    if name=='FE_REGRESSION' and (EV/'verification.json').exists():
        body+='''
## Kết quả cuối đã xác nhận

| Check | Exit / result |
|---|---|
| npm run typecheck | 0 / PASS |
| npm run lint | 0 / PASS, 0 errors/warnings |
| npm test | 0 / 198 pass, 0 fail/skip/todo |
| SSE subset | 13 pass trong198, fake stream/timers |
| expo install --check online | 1 / đúng11 mismatch nền |
| expo-doctor | 1 / 19/20, chỉ version check |
| Expo export Android/iOS/Web sau source-freeze | 0 / PASS,36 static routes |
| git diff --check | 0 / PASS |
| Rendered / RealAPI / NFC / screen reader | BLOCKED hoặc NOT_RUN, không PASS |

21 tệp quan trọng thuộc Auth/POS adapters/lifecycle/session/sale/journal/QR/NFC/E0/F scope được đối chiếu hash với đầu G và giữ nguyên. Artifact scan không thấy fixture URLs hoặc __ui/emit; bare18086 nằm trong Reanimated worklet hash9106121518086, không endpoint. Chi tiết machine-readable trong verification.json.
'''
    if name=='PERFORMANCE' and (EV/'bundle-metrics.json').exists():
        metrics=json.loads((EV/'bundle-metrics.json').read_text(encoding='utf-8'))['phases']
        body+='\n## Kích thước artifact filesystem đã đo\n\n| Platform | F bytes | G bytes | G − F bytes |\n|---|---:|---:|---:|\n'
        for platform in ['android','ios','web']:
            old=metrics['f'][platform]['total_bytes']; new=metrics['g'][platform]['total_bytes']
            body+=f'| {platform} | {old} | {new} | {new-old:+} |\n'
        body+='\nNative là exported Hermes bytecode; Web là tổng JS chunks, không transfer gzip hoặc first-screen payload. Module counts/hash từng artifact ở verification.json/bundle-metrics.json. Đây là kích thước output, không chứng minh memory/FPS/startup cải thiện.\n'
    (OUT / f'{PREFIX}{name}.md').write_text(f'# CASMS Mobile Phase G — {name}\n\n'+BASE+body, encoding='utf-8')

# ID, priority, route, file(s), cause/before, implementation/after, skill, evidence, blocker/status
findings = [
('G-01','P1','Toàn Passenger/NotificationSync','src/features/notifications/notification-stream.ts','Watchdog được gia hạn theo bytes và abort sau45s; hub không heartbeat nên kết nối khỏe cũng bị ngắt.','45s chỉ cho handshake connected; silence khỏe không abort. Lease30min theo NotificationSseHub; EOF/error reconnect; chỉ stable60s mới reset retry budget.','expo-data-fetching; impeccable optimize','notification-realtime.test.mjs: healthy idle, malformed handshake, EOF/lease, rapid close','SOURCE_FIXED; BE-10 runtime còn OPEN'),
('G-02','P2','/notifications','src/features/notifications/PassengerNotificationsScreen.tsx; src/features/passenger-actions/PassengerActionUI.tsx','API trả toàn hộp thư; map trong ScrollView mount tất cả hàng, không giới hạn dataset.','FlatList một scroll owner, UUID key, initial12; giữ read/read-all/detail/voyage guards và trạng thái hiện có. LivePage mặc định vẫn scroll cho consumer khác.','expo-native-ui; expo-data-fetching; impeccable optimize','native-ui-hardening.test.mjs + full suite; benchmark thiết bị pending','SOURCE_FIXED; large dataset/device benchmark OPEN'),
('G-03','P2','Login/Services/POS/forms','src/constants/ocevie.ts; components/passenger/{OutlinedField,PassengerUI}.tsx; features/{passenger-actions/PassengerActionUI,pos/pos-ui}.tsx','Viền tương tác dùng #D5E0E4 vốn dành cho phân cách; search chỉ có placeholder mất khi nhập.','Map controlBorder #718391 từ OceVie canonical; giữ divider riêng. Search có nhãn nhìn thấy; input16; focus teal.','expo-design-system; ui-ux-pro-max; frontend-design','native-ui-hardening.test.mjs kiểm contrast >=3 cho boundary, >=4.5 cho text','SOURCE_FIXED; visual focus QA OPEN'),
('G-04','P1','Các picker Passenger/POS','src/features/passenger-actions/PassengerActionUI.tsx: Choice','Trigger disabled nhưng options trong sheet đã mở vẫn bấm được; tên accessible không chứa giá trị đã chọn.','Options disabled và guard handler khi pending; nhãn trigger gồm label + selected label; không đổi choice/business state khi khóa.','expo-native-ui; impeccable harden','typecheck/lint; C/D journal + session tests; interaction native chưa chạy','SOURCE_FIXED; rendered busy-toggle QA OPEN'),
('G-05','P2','Mọi PassengerSheet','src/components/passenger/PassengerSheet.tsx; MaterialIcon.tsx','Backdrop là một nút screen reader trùng Close; icon chỉ có web aria-hidden; keyboard Android chưa có avoidance behavior.','Backdrop decorative, Close48px vẫn dùng được; native icon hidden; sheet top inset và Android height avoidance, scroll keyboard insets. Giữ pending dismissal lock/exit snapshot.','expo-native-ui; impeccable accessibility/adapt','existing sheet-presence tests; typecheck/export; keyboard/SR native pending','SOURCE_FIXED; rendered keyboard/focus OPEN'),
('G-06','P2','/staff-pos; /staff-pos/requests','src/features/pos/{pos-ui,PosDashboard,PosServices}.tsx; pos-layout-metrics.ts','POS bị giới hạn600px như Passenger; thao tác/detail tuần tự dù có nhiều chiều rộng.','Dashboard context/work hai pane; Request details/actions hai pane khi available width/fontScale >=840. Phone/chữ lớn một cột. Forms/scanner/statement giữ600. Không tạo route/API hoặc bỏ xác nhận.','expo-design-system; impeccable adapt; ui-ux-pro-max','posColumns unit:320/375/430/768/840/1024/1280, font1.3/1.5/2; POS full regressions','SOURCE_FIXED; tablet render OPEN'),
('G-07','P2','/home; Passenger tabs','src/features/home/VoyageHomeParts.tsx; components/passenger/PassengerNavigation.tsx; PassengerScaffold.tsx','Cột giờ cố định46 có thể cắt chữ tăng cỡ; thông tin tàu/ngày/cabin12–13; tab label không có maxWidth.','Cột giờ intrinsic; facts/body dùng typeScale.body15; summary dùng radius/spacing shared. Tab text giới hạn chiều rộng của tab và wrap; heading minWidth0.','frontend-design; expo-design-system; impeccable polish','typecheck/lint/export; Today/timezone tests giữ; Dynamic Type render pending','SOURCE_FIXED; scaled UI QA OPEN'),
('G-08','P2','/check-in; /cruise; bookings; services; activities','src/features/passenger-actions/{PassengerCheckInScreen,PassengerBookingScreens,PassengerServiceRequestsScreen,PassengerActivitiesScreen}.tsx; features/home/PassengerDestinationScreen.tsx','isPending cũng đúng khi query paused/disabled; có màn hiện spinner đang tải khi thực tế chưa fetch.','Spinner dùng isLoading; các read chính có lời nhắc chờ kết nối. Booking empty chỉ sau isSuccess. Không mở nút ghi hoặc đổi điều kiện submit.','expo-data-fetching; impeccable harden','full contract tests/typecheck; offline rendered pending','SOURCE_FIXED; offline device QA OPEN'),
('G-09','P2','Home/Itinerary/QR/POS clocks','src/hooks/use-now.ts; foreground-clock.ts','Interval hiển thị chạy cả khi AppState background; mỗi consumer vẫn giữ timer.','Dừng display interval ở background/inactive; tick ngay khi active; cleanup listener/timer và guard late ticks. Session expiry timer/Date.now mutation checks giữ nguyên.','impeccable optimize; expo-native-ui','2 foreground-clock tests trong native-ui-hardening.test.mjs; expiry/journal full regression','SOURCE_FIXED; battery/FPS benchmark OPEN'),
('G-10','P1','Tất cả route thực tế','evidence/runtime-inventory.txt; android-runtime.txt; browser-runtime.txt','Runtime F chưa load product. G AVD boot được, ExpoGo58.0.5; không có CASMS dev-client package. IAB webview attach timeout2 lần; localhost preview probe HTTP000.','Đã phân loại SDK/ADB có, runtime hiện chưa đủ product UI. Không kết luận source lỗi/Backend lỗi từ lỗi kết nối. Helpers đã đóng; runbook Phase M trong runtime report.','frontend-testing-debugging; expo-native-ui','logs thực tế, không screenshot giả','OPEN: RENDERED_UI_BLOCKED / Phase M'),
('G-11','P2','Performance toàn Mobile','hooks; notifications; pos; dist/phase-g','Chưa có startup/FPS/memory trace hoặc dataset lớn. Source timers/list đã xác minh, chưa chứng minh jank cụ thể ở các list khác.','Chỉ sửa timer/list/SSE có bằng chứng. Ghi bytes artifact nếu export xong; không phần trăm cải thiện hoặc blanket memo/virtualization.','impeccable optimize; expo-design-system','verification.json / bundle-metrics.json; device benchmarks NOT_RUN','OPEN: representative hardware/dataset'),
('G-12','P2','Native Back/landscape','app.json; src/app/(passenger)/_layout.tsx','App đã khóa portrait và predictiveBackGestureEnabled=false. Không có native Back/rotation/focus test.','Giữ cấu hình, không tự thay native build. Passenger tabs backBehavior history; sheet onRequestClose/pending guard vẫn còn. Landscape native N/A theo config hiện tại.','expo-router; impeccable adapt','source static; hardware Back NOT_RUN','OPEN: Phase M native acceptance'),
]

def finding_register(rows):
    text=''
    for fid,p,route,file,before,after,skill,test,block in rows:
        text+=f'## {fid} — {p}\n\n| Trường | Nội dung |\n|---|---|\n'
        for label,value in [('Finding ID / Priority',fid+' / '+p),('Screen/route',route),('File path (dưới CASMS_MobileApp)',file),('Root cause / Before',before),('After / Proposed fix',after),('Skill applied',skill),('Test evidence',test),('Rendered evidence','RENDERED_UI_BLOCKED; không ảnh mới'),('Blocker / Acceptance status',block)]:
            text+=f'| {label} | {value} |\n'
        text+='\n'
    return text

# Route behavior and audit conclusion; shared findings are referenced, not fabricated per screen.
behaviors={
'index.tsx':('Entry → splash','Không có tác vụ nghiệp vụ; giữ redirect','Không phát hiện lỗi route mới'),
'splash.tsx':('Brand/restore gate','Giữ restore trước redirect; reduced motion có sẵn','G-10; chưa kiểm startup render'),
'loading.tsx':('Me/voyages/role landing; retry/logout','Giữ hydration/deep-link và paused guidance','G-10; không thay Authentication'),
'login.tsx':('Employee hoặc Passenger login; password/recovery','OutlinedField/Button reuse; controlBorder; không đổi role landing','G-03/G-05; keyboard/SR pending'),
'forgot-password.tsx':('Guidance liên hệ đơn vị cấp tài khoản','Không fake reset API/success','BE support contract vẫn OPEN'),
'(passenger)/home.tsx':('Voyage/ship/cabin/Today/upcoming/quick actions/unread hint','VoyageHomeParts cải thiện typography/time width, không hero ảnh mới','G-07/G-09'),
'(passenger)/itinerary.tsx':('Daily/ports/Today/sea-day/planned-actual/zone/tour/history sheets','Giữ exact voyage/day/stop validation F; dùng shared sheet','G-05/G-09; BE-22 published history OPEN'),
'(passenger)/services.tsx':('Hub/search/category/detail/slots/request/result/My Requests','Search nhãn visible; spinner đúng fetch; journal/draft giữ','G-02 shared LivePage default/G-03/G-04/G-08'),
'(passenger)/notifications.tsx':('Inbox/unread/read/read-all/detail/connection/switch voyage','FlatList và healthy idle SSE; không ACK','G-01/G-02/G-05; BE-21/22'),
'(passenger)/account.tsx':('Profile/booking/switch voyage/packages/support/logout confirm','Giữ identity/confirmation; hưởng shared sheet/choice/labels','G-03/G-04/G-05'),
'bookings.tsx':('Legacy redirect → passenger-bookings','Không tạo booking mới','Giữ A0 regression'),
'explore.tsx':('Legacy redirect → services','Không tạo menu API chưa hỗ trợ','Giữ A0 regression'),
'check-in.tsx':('Progress/emergency contact/conditions/boarding-ready','Paused guidance thay spinner; contract/preflight/HTTPS guards giữ','G-04/G-05/G-08'),
'cruise.tsx':('Selected ship/cabin/decks/public-model metadata khi yêu cầu','Paused guidance; không GLB/render/indoor position','G-08; M15 OPEN'),
'passenger-activities.tsx':('Activities/tours/registration/detail entitlement/confirm/edit/cancel/My registrations','Shared numeric Input/Choice/ConfirmAction; spinner/paused phân biệt','G-04/G-05/G-08; BE-16/17 OPEN'),
'passenger-packages.tsx':('Purchased entitlement/usage quota/blockers','Server quota/null semantics; không package purchase hoặc cash substitution','Shared controls/sheet regression; legacy quota OPEN'),
'passenger-qr.tsx':('Server claim/expiry/renewal/card guidance','Giữ quiet16, size clamp, raw claim không xuất text/log','G-09 display timer; scan trên thiết bị pending'),
'passenger-services.tsx':('My requests/service history và toàn request flow companion','Giữ journal khi sheet đóng; không auto replay','G-03/G-04/G-05/G-08'),
'spending.tsx':('E0 spending guidance theo voyage state','Không số dư/transaction/settlement giả; chưa tích hợp Folio','M06/M07 OPEN; source E0 giữ'),
'support.tsx':('Emergency/desk/ordinary FAQ/account help','Guidance thật; không phone/chat/ticket/success giả','BE-24 OPEN; shared a11y source'),
'passenger-bookings/index.tsx':('Existing booking list','Empty chỉ isSuccess; paused guidance; không mua vé','G-08; E0 money formatter giữ'),
'passenger-bookings/[bookingId].tsx':('Booking/passengers/cabin/payment/contract/cancellation guidance','Paused detail/payment riêng; giữ unknown/currency và labels server','G-08; không legacy cancellation mutation'),
'passenger-bookings/new.tsx':('Retired creation redirect → list','Không mở booking mới','Giữ A0 regression'),
'staff-pos/index.tsx':('Shift/context/queue/work/scanner/close session/logout','Dashboard hai pane nếu đủ width; confirmations giữ','G-06; M17/BE-18/19 OPEN'),
'staff-pos/services.tsx':('Readable services/price/search/filter','Form width600; shared Field contrast/keyboard','G-03/G-05; không product sale mới'),
'staff-pos/requests.tsx':('Requests/detail/assign/accept/reject/start/fulfillment','Hai pane details/actions; exact passenger/context và preflight giữ','G-04/G-06; quota/usage handoff OPEN'),
'staff-pos/activities.tsx':('Activity detail/registration/create/edit/attendance/lifecycle','Giữ Date.now/permission/preflight; shared choice/input/sheet','G-04/G-05/G-09; native render pending'),
'staff-pos/scanner.tsx':('QR preview/confirm và NFC lookup','Camera focus/AppState teardown có; NFC unavailable trong Go/Web','BE-08/09/14; native device OPEN'),
'staff-pos/usage.tsx':('Service sale/receipt/pending recovery/allowance/statement','600px bounded form; journal/idempotency/confirmation unchanged','G-03/G-04/G-05/G-09; BE-19/20 OPEN'),
}
routes=[]
for p in sorted((APP/'src/app').rglob('*.tsx')):
    rel=p.relative_to(APP/'src/app').as_posix(); source=p.read_text(encoding='utf-8')
    components=re.findall(r"from ['\"](@/[^'\"]+)['\"]",source)
    target='; '.join(dict.fromkeys(components)) or 'Inline layout/route'
    if p.name=='_layout.tsx':
        behavior=('Layout: auth/provider/Stack' if rel=='_layout.tsx' else 'Layout: Passenger tabs5/back history' if '(passenger)' in rel else 'Layout: Employee/device/terminal/session gate')
        fix='Giữ gate, permissions, route keys và pending journals; G không rewrite router'
        issue='STATIC_VERIFIED; hardware Back/session render pending'
    else: behavior,fix,issue=behaviors[rel]
    route='/' + re.sub(r'\(passenger\)/','',rel).removesuffix('.tsx')
    route=route.removesuffix('/index') or '/'
    routes.append(dict(file='CASMS_MobileApp/src/app/'+rel,route=route,component=target,current=behavior,fix=fix,issue=issue,layout=p.name=='_layout.tsx'))
(EV/'screen-inventory.json').write_text(json.dumps(routes,ensure_ascii=False,indent=2),encoding='utf-8')

baseline=json.loads((EV/'baseline-hashes.json').read_text(encoding='utf-8-sig'))
known={Path(x['path']).resolve():x['sha256'].lower() for x in baseline}
changed=[]
for directory in ['src','tests','docs']:
    for p in (APP/directory).rglob('*'):
        if p.is_file():
            digest=hashlib.sha256(p.read_bytes()).hexdigest()
            if known.get(p.resolve())!=digest: changed.append((p.relative_to(ROOT).as_posix(),digest))
filelist='\n'.join('- `'+p+'`' for p,_ in changed)
(EV/'changed-files.json').write_text(json.dumps([dict(path=p,sha256=s) for p,s in changed],indent=2),encoding='utf-8')
inventory='| Route / layout | File / screen component | Current behavior | UX issue / severity / root cause | Fix / existing reuse | Evidence |\n|---|---|---|---|---|---|\n'
for row in routes:
    inventory+=f"| `{row['route']}` | `{row['file']}` → {row['component']} | {row['current']} | {row['issue']}; root cause chi tiết theo finding register | {row['fix']}; PassengerScaffold/Button/Sheet/UI, POS Field/Notice/QueryState | STATIC_VERIFIED; RENDERED_UI_BLOCKED |\n"
write('SCREEN_INVENTORY',LIMIT+f"Có {len(routes)} tệp route/layout thực tế, {sum(not r['layout'] for r in routes)} entry màn/redirect và {sum(r['layout'] for r in routes)} layout. Subscreen không có route riêng liệt kê bên dưới.\n\n"+inventory+'''
## Subscreen và trạng thái không có route riêng

| Workspace | Subscreen / state | Source / reuse | Audit |
|---|---|---|---|
| Authentication | Restore, expiry, account recovery, voyage selection | session-store, PassengerLoadingScreen, PassengerVoyageChooser | Exact owner/API/epoch; retry/logout; Choice/InfoRow/Sheet |
| Home/Itinerary | Today, sea day, stop/tour/group/clock/change sheets, removed day/stop | PassengerLiveItineraryScreen/ItineraryUI | UTC fallback được ghi nhãn; không tự tạo giờ, canonical history chặn BE-22 |
| Services | Detail/schedule/quantity/note/confirmation/result/My Requests/history/recovery | ServiceDetail, PassengerServiceRequestsScreen, ConfirmAction | Null price không zero; pending lock; journal khi sheet đóng; no auto replay |
| Activities | Detail/entitlement/availability/register/edit/cancel/confirm/My registrations | PassengerActivitiesScreen, EntitlementSummary | Exact BP/cruise/stop; numeric input; no purchase |
| Identity | Check-in contact/confirmation/progress; QR claim/expired/renewal | PassengerCheckInScreen, PassengerCardScreen | Raw claim không hiện; backend authoritative |
| POS setup | Employee/device login, terminal selection/manual ID, session restoration/close | PosLayout/PairTerminal/SessionGate/ActiveSession | Web POS blocked chủ ý; không bypass để screenshot |
| POS requests | Detail + accept/reject/start/full fulfillment/entitlement | PosServices/RequestEntitlement/FulfillmentField | Two panes chỉ layout; preflight/busy/journal giữ |
| POS activities | Detail/create/edit/registration confirm/cancel/attendance/lifecycle | PosActivities/ActivityDetail | ConfirmAction + samePosScope/Date.now guards |
| POS identity | Camera permission/error/scanner/preview/confirm, NFC lookup | PosScanner/PosCardAction/nfc-reader | Không nghiệm thu NFC bằng Go; teardown được giữ |
| POS finance | New sale confirmation/receipt/recovery/allowance/statement/session close | PosUsage/PosDashboard | Không Folio; same-key recovery cần explicit action; không auto replay |
''')

write('FE_IMPLEMENTATION',LIMIT+'**UI_UX_SOURCE_READY_RUNTIME_QA_BLOCKED**. Đã triển khai các cải thiện có căn cứ, không chỉ audit.\n\n## Files source/test thay đổi trong G\n\n'+filelist+'\n\nDanh sách hash phân biệt G với working tree trước: evidence/changed-files.json và baseline-hashes.json. Tài liệu gồm15 báo cáo, evidence, OceVie Mobile và hai handoff/backlog.\n\n'+finding_register(findings))
write('PASSENGER_UI_UX_AUDIT',LIMIT+'''Audit toàn bộ Passenger routes và subscreen, không giới hạn Phase F; mapping đầy đủ ở SCREEN_INVENTORY. Không phát hiện P0 mới qua source; điều này không phải bằng chứng không có lỗi native. Các blocker P0 Folio cũ giữ OPEN.

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

'''+finding_register([f for f in findings if f[0] in ['G-01','G-02','G-03','G-04','G-05','G-07','G-08','G-09']]))
write('PASSENGER_UI_UX_IMPLEMENTATION',LIMIT+'''Giữ5 tab Trang chủ/Lịch trình/Dịch vụ/Thông báo/Tài khoản và route behavior A0/A. Passenger nội dung tối đa600px; facts dùng typeScale.body, time column không khóa46px. Shared controlBorder lấy canonical OceVie, search giữ label khi nhập; Choice thông báo giá trị và ngăn option thay đổi khi bị disable. Button không đổi animation/behavior.

LivePage thêm scroll=false chỉ cho notification FlatList; default=true bảo toàn toàn consumer Services/Activities/Check-in/Bookings/Spending/Account. FlatList giữ list header (count/status/actions/loading/empty/error), item UUID, sheet detail ngoài list. Một scroll owner, không FlatList lồng ScrollView. Không tạo pagination khi API chưa hỗ trợ.

Check-in/booking/payment detail/ship metadata/decks và registrations/request loading dùng isLoading; paused có hướng dẫn, empty booking chỉ khi isSuccess. Không chuyển unknown thành0. Sheet giữ snapshot khi exit và khóa dismiss pending; thêm keyboard/inset native source safeguards.

Service Hub → detail → schedule → confirm → result → My Requests, Activity → register → confirm → My Registrations vẫn dùng cùng mutation/preflight/journal từ C. QR claim/quiet zone/expiry/renewal và account logout confirm giữ. Chỉ display clock được pause background, resume tick ngay; mọi write guard vẫn dùng actual Date.now/server.

Không mở thêm chức năng chưa có contract: booking mới, activation, Folio/settlement, ACK, push, renderer3D, support chat/ticket. Audit/test evidence cụ thể theo G-01…09 trong FE_IMPLEMENTATION. Navigation/keyboard/hardware Back chưa rendered verify.
''')
write('STAFF_POS_UI_UX_AUDIT',LIMIT+'''Audit toàn bộ Staff POS, kể cả state không có route riêng; không dùng Web để bypass PosLayout.

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

'''+finding_register([f for f in findings if f[0] in ['G-03','G-04','G-05','G-06','G-09','G-12']]))
write('STAFF_POS_UI_UX_IMPLEMENTATION',LIMIT+'''Chỉ sửa PosDashboard.tsx, PosServices.tsx (phần composition của PosRequests), pos-ui.tsx và thêm pos-layout-metrics.ts. Shared Passenger primitives phục vụ cả POS cũng được harden. Không sửa PosLayout/session transport/storage/scope/lifecycle, PosUsage sale/recovery, scanner/NFC API.

PosPage wide là opt-in cho Dashboard và Requests, max1120; các form/statement/scanner/activities giữ600. PosColumns dựa useWindowDimensions và effective width/fontScale, split840; phone320–430, tablet768 hoặc chữ lớn vẫn một cột; width1024/1280 đủ điều kiện có hai pane. Request không có action được cấp quyền sẽ không tạo pane action rỗng. Thứ tự đọc vẫn context trước work, detail trước action, phone không mất chức năng.

PosPage có KeyboardAvoidingView theo platform và ScrollView insets/taps handled. Field có contrast boundary đủ3:1. Request context hiển thị terminal name/user; exact BP/schedule/service vẫn hiện trước thao tác. Các action guards, confirmations, entitlement, full fulfillment, journal, same-key replay và Date.now preflight giữ nguyên.

Không có native tablet portrait/landscape screenshots. Landscape native N/A (portrait config); multi-window logic unit pass không thay thế render. Không master-detail route mới, permission workaround hoặc API mới.
''')
write('DESIGN_SYSTEM',LIMIT+'''Nguồn Mobile: src/constants/ocevie.ts; mapping passenger-light-theme.ts; docs/ocevie-mobile-ux.md. Đối chiếu canonical design-systems/ocevie/{DESIGN.md,tokens.css} nhưng không sửa Web/canonical CSS.

| Layer | Contract sau G | Consumers |
|---|---|---|
| Brand/semantic | Navy #0B2A4A primary/text, pearl #F8F6EC, teal #0E6B7A interaction, gold accent; status+text | Palette giữ |
| Boundary | controlBorder #718391 cho interactive input; border #D5E0E4/divider riêng | Login/Search/Input/Choice/POS Field |
| Typography | Existing typeScale; facts Body15/23; scalable text, không global font cap | Home + shared content |
| Spacing/radius | Existing spacing4…32; controls.touch48/radius14/card18/button52 | Scaffold/Button/Home/PosColumns |
| Widths | contentLayout passenger600/POS1120/form600/split840/pane320 | UI content/Scaffold/POS; phone single-column |
| Button | Existing filled/text/secondary/premium; disabled/loading/busy/pressed | Không tạo Button thứ ba |
| Field/choice/search | Visible label, disabled option guard, selected value accessible, input16 | Reuse hiện có |
| Sheet/modal | Existing PassengerSheet snapshot/close/pending/reduced motion; native backdrop hidden/keyboard/insets | Không tạo overlay library |
| Lists/status | InfoRow/PassengerListItem/EmptyState/ErrorNotice/Loading/QueryState/FilterChips | Notification FlatList vẫn dùng PassengerListItem |
| Tabs/nav | Existing5tabs + selected text/indicator; label wrap in tab | Không rewrite Router |
| Motion/shadow | Existing motion tokens/provider và reduced motion giữ | Không animate-ui Web vào native; không thêm animation |

Native system controls @expo/ui đã có nhưng G ưu tiên sửa incumbent primitives theo yêu cầu; không migrate control system chỉ vì skill gợi ý. Skill expo-ui/performance/accessibility riêng không có trong catalogue cài thực tế. Light/portrait là cấu hình hiện tại; không công bố dark theme/native landscape đã hỗ trợ. Các hardcoded legacy one-off còn lại được ghi maintenance; không refactor tất cả để giảm literal count hình thức.
''')
write('ACCESSIBILITY',LIMIT+'''Đây là static review, không TalkBack/VoiceOver certification. Native accessibilityLabel/Role/State được dùng; không chuyển Web ARIA thành native solution.

| Hạng mục | Evidence / action | Gate |
|---|---|---|
| Controls | Button busy/disabled labels vốn có; password visibility thêm disabled state; Choice nêu selected value + disabled options | STATIC_VERIFIED |
| Icons | MaterialIcon decorative có native accessible=false/elementsHidden/no-hide-descendants | STATIC_VERIFIED; SR traversal pending |
| Modal | Backdrop không còn duplicate focus target; Close48px; onRequestClose và pending guard giữ | STATIC_VERIFIED; focus restore/trap/escape native pending |
| Text scaling | Không tắt allowFontScaling; tab labels maxWidth; Home time intrinsic; effective-width POS split | Logic unit pass; large font render pending |
| Contrast | Navy/teal/secondary/placeholder trên white/pearl; controlBorder>=3, body>=4.5 | Calculated unit pass; toàn pixel screenshot chưa kiểm |
| Touch | Existing touch48/button52, row60+, Close/eye48 | Static; clipped hit areas/device touch pending |
| Loading/error | Loading accessible busy + label; errors selectable/alert; paused states text riêng | Source; announcements timing pending |
| Color-only | Status/unread/connection có text, tab selected state và marker | Source; không kết luận mọi Backend enum mới đã mapping |
| Keyboard | Existing login KAV, shared sheet/POS KAV + scroll handled; no auto new keyboard library | Render pending Android/iOS/Web |
| Reduced motion | Existing provider một OS listener, sheet/button/launch respect reduced; không thêm motion | Source + existing tests; OS toggle pending |
| Reading order | Dashboard context→work, request details→actions; small width vertical | Source; SR native pending |

Manual matrix khi Phase M có build: Login/failure/retry; request invalid qty/failed-save/busy picker; registration; emergency contact; QR expiry/renewal; notification read/read-all/detail; sale/receipt/recovery/fulfillment; sheet Back/Close/focus-return; 200% text và phone/tablet. Không chụp claim/UID/JWT hoặc dữ liệu khách thật.
''')
write('PERFORMANCE',LIMIT+'''Chỉ xử lý issue có source evidence. Không số phần trăm/FPS/memory improvement được công bố.

| Surface | Evidence trước | Sau / giới hạn |
|---|---|---|
| SSE silence | 45s watchdog abort kết nối không heartbeat | Handshake45s, established idle không abort, lease30min; 120s fake-clock test:1connection, REST2 lần sau baseline |
| Inbox | Full list map trong ScrollView, API không pagination | FlatList initial12, UUID keys, một scroller; all JSON vẫn được fetch/parse, không giả server pagination |
| Display clocks | useNow giữ interval ở background/inactive | Timer dừng; resume reconcile Date.now;2 lifecycle tests chứng minh cancellation/late guard |
| Query/cache | Shared keys owner/API/epoch, stale30s; F predicate excludes journals/POS/finance | Giữ dedupe ReactQuery; coalescing250ms, bounded retries5; không mutation invalidation event |
| Startup/restore | SecureStore/role/me/voyages gate, không GLB prefetch | Giữ; startup/native CPU/time chưa đo |
| Assets/model | Model metadata on-demand; local GLB F ~281MB/~182MB | Không thêm asset/renderer; M15 memory/load/dispose benchmark pending |
| Camera/NFC | Focus/AppState unsubscribe và cancelTechnologyRequest existing | Không rewrite; physical camera/NFC leak test pending |
| Motion | Existing reduced-motion provider; no new animation | Frame trace/JS thread time pending |
| Other lists | Request/activity/statement map lists; chưa có representative dataset/performance trace | Không blanket virtualize/memo; QA large dataset cần DB-04/06 |
| Bundle | dist/phase-g sau source-freeze | Bytes/modules ở evidence/bundle-metrics.json khi export complete; bytes không là native memory/TTI |

Benchmark cần Phase M: cold/warm startup→meaningful frame, session restore online/offline; thousand inbox rows scroll, large request/statement fixtures và real QA; 30min SSE + suspend/resume/token/account switch; FPS/JS/memory allocation before/after route/pop/camera/NFC, representative phone/tablet Android/iOS. Phải đo cùng build/dataset/hardware; không lấy thời gian Metro/export làm runtime performance.
''')
write('SSE_HARDENING',LIMIT+'''Contract được đọc lại từ CASMS_Backend/src/main/java/com/casms/notification/service/NotificationSseHub.java: SSE_TIMEOUT_MS=30L*60L*1000L, max3 emitters/user, connected frame, completion/timeout/error cleanup; không heartbeat/replay. FE NotificationSync/app-query-focus/session-store/notification-queries/tests cũng được đọc lại.

G-01 xác nhận lỗi: idle watchdog45s được reset trên bytes; healthy connection không có business event vẫn abort, tiêu5attempt rồi fallback. G tách handshake: từ connect cần valid connected trong45s. Headers/body/comment/malformed frame không tự chứng minh established. Khi valid connected, clear handshake; business silence không network failure. Timer lease30min theo source contract bảo đảm rotation kể cả network half-open; không heartbeat giả. Server EOF/error/lease abort đều reconcile GET rồi bounded retry.

Budget: tối đa5 lần liên tiếp với backoff1/2/4/8sec jitter0.8–1.2. Accepted stream đóng ngay không reset attempts; stable60s (cùng cadence REST freshness) mới reset. Một stream thành công hàng chục phút không tiêu cả lifetime budget. Repeated connected chỉ xử lý một lần; coalesce250ms, dedupe256; REST60s vẫn chạy foreground vì impact producer có thể không publish. Không event→POST.

JWT refresh/owner/API/epoch/background đổi effect cleanup abort/cancelreader/timers; foreground mới xác minh current token/context rồi nối lại; invalidation predicate không chạm POS/Folio/journal. 401/403 stop retries/poll và invalidate me theo behavior hiện có. User-facing live chỉ nói đã kết nối khi ứng dụng mở, không tuyên bố Backend producer luôn giao đủ event.

13 SSE unit/controller tests (9 cũ giữ, rename idle test thành handshake chính xác +4 ca mới): parser/invalidframes/headerGET/coalesce/authdeny/backoff/handshake/healthyidle/malformed handshake/EOF+lease/rapidclosure/stalecallback/tokenrefresh/predicate. Đây là fake stream/timers, không native proxy test.

BE-10/M05 OPEN: proxy buffering/idle budget/JWT expiry/in-memory emitter teardown/cross-instance/producer identity/heartbeat-replay và real device SSE chưa xác nhận. REST authoritative không che Backend bug. ACK BE-21/Folio M06/M07/push BE-23 không được mở.
''')
write('RUNTIME_READINESS',LIMIT+'''## G0 findings

| Layer | Kết quả G | Phân loại |
|---|---|---|
| Node/npm/Expo | Node24.18.0/npm11.16.0, Expo~58.0.23/local CLI khởi động Metro | Toolchain source/export khả dụng |
| Environment | ANDROID_HOME/ANDROID_SDK_ROOT trống, adb không trong PATH | Dùng đường dẫn SDK tường minh; không sửa permanent env |
| SDK/AVD | C:/Users/quanh/AppData/Local/Android/Sdk; Pixel_8 có | Không cài SDK/APK |
| ADB | Sandbox daemon lỗi; host execution đọc emulator-5554 device, sys.boot_completed=1 | Sandbox khác host; không kết luận emulator hỏng |
| Runtime | Android16 x86_64, Expo Go version58.0.5; pm list không có CASMS/OceVie package | Same major không chứng minh module compatibility; thiếu dev build đã nghiệm thu |
| Metro | Local fixture18086 + expo start --web --port8086 chạy; CI reload disabled | Log startup không chứng minh browser connectivity |
| Connectivity | HTTP local probe trả000; IAB createBrowserTab timeout attach2 lần | RENDERED_UI_BLOCKED; root cause network/tool attachment chưa xác minh |
| Native F issue | G xác nhận boot tốt; chưa product UI; F ANR/remote update evidence giữ | Không nói G tái hiện chính xác ANR hoặc source gây remote update |
| NFC | Installed JS module4.3.0/config có, dynamic bridge rejects storeClient/Web | Native custom module cần dev build; không nghiệm thu trên Go |
| Backend | QA URL/accounts/dataset/mutation quyền chưa xác nhận | Không startup Backend/seed/migrate/RealAPI |

## Quy trình khởi động đã thử và phần bàn giao M

Trong CASMS_MobileApp, shell-local UI_FIXTURE_PORT=18086, node tests/fixtures/passenger-api-server.mjs; shell-local EXPO_PUBLIC_API_URL=http://127.0.0.1:18086/api, npx --no-install expo start --web --port8086. Chỉ test fixture in-memory; không ghi .env, production bundle dùng env hiện hữu thay vì fixture. Tool logs ở evidence. Android emulator dùng API host alias10.0.2.2 nếu sau này test native; G chưa xác minh kết nối alias, không công bố runbook end-to-end pass.

Phase M cần: xác nhận host/AVD/Metro/API loopback path trong môi trường được phép; đúng SDK58/RN0.88 build, expo-dev-client và react-native-nfc-manager plugin/native rebuild, Android toolchain/JDK/Gradle/signing profile và physical NFC device. iOS cần approved build/signing/capabilities/device. Đọc app.json để lấy scheme/config chính xác. Không tự prebuild trên source chính, cài APK hoặc đổi firewall/security. App native đang portrait/light; landscape test cần quyết định/config build riêng nếu mở.

Helpers G đã đóng: fixture node27488, npx24668, Metro29056 (command line được xác minh trước Stop-Process); AVD emu kill trảOK. Không đóng LDPlayer/browser người dùng. G0 hoàn thành phân loại và bàn giao, chưa đạt gate rendered/native.
''')
write('RENDERED_UI_QA',LIMIT+'''Flow dự kiến: Login → Home → itinerary/services/activities/packages/QR/notifications/account/spending/support; employee → terminal/session → dashboard/requests/fulfillment/activities/scanner/sale/statement. Các flow này CHƯA chạy trên product UI trong G.

| Check | Result | Evidence |
|---|---|---|
| Browser availability | Browser skill/plugin absent; CUA IAB present nhưng webview attach thất bại | Hai lần createBrowserTab(127.0.0.1:8086/login) timeout |
| Playwright fallback | Không có playwright/@playwright/test/puppeteer trong Mobile node_modules | Không install khi chưa duyệt |
| Native | AVD boot1/ExpoGo58.0.5; dev-client package chưa có | android-runtime.txt; chưa UI render |
| Page identity/not blank/framework overlay | NOT_VERIFIED | Không DOM/screenshot app |
| Console health | NOT_VERIFIED | Metro warning không thay thế browser console |
| Before/after screenshots | NOT_AVAILABLE | Không mockup/ảnh generate thay app |
| Primary action/failure/retry loop | NOT_RUN | Không claim interaction pass |
| Phone320/375/430 | STATIC layout logic review only | G-06/G-07, no viewport screenshot |
| Tablet768/1024/1280 | POS effective-width unit tests only | Không TABLET_UI_PASSED |
| Native landscape | N/A theo app orientation portrait | Không đổi orientation toàn app |
| Keyboard/safe area/scroll/modal/Back/font scale | Source safeguards; rendered NOT_RUN | Phase M cần thiết bị/build |

Fixture preview nếu chạy được sau này phải ghi rõ FIXTURE_UI_ONLY. RealBackend QA chỉ được chạy khi đội BE/DB xác nhận URL/actors/dataset/quyền mutation. Không có credential/JWT/claim/UID trong screenshot vì không có screenshot sản phẩm mới.

G-10 vẫn OPEN; route inventory và source implementation tiếp tục đủ phạm vi dù runtime bị chặn. Không dùng export pass để đóng visual gate.
''')
write('FE_REGRESSION',LIMIT+'''Baseline189/189 được giữ. Bộ cuối198/198 (thêm4 SSE +3 UI/layout/contrast/static contract +2 display-clock), không skip/todo hoặc giảm assertion. SSE subset13/13 nằm trong198. Logs chuẩn: evidence/{tests,typecheck,lint,doctor,dependency-check,export,git-diff-check}.txt; verification.json tổng hợp exit status sau check cuối.

Typecheck/lint và Expo export Android/iOS/Web là gate bắt buộc; chỉ kết luận khi final log complete. Expo install --check online giữ đúng11 mismatch cũ; Doctor19/20 chỉ version check fail, không exclude/fix dependency. Sandbox offline map ban đầu nói up-to-date không được dùng làm nghiệm thu; online log thay thế. Advisory B chưa chạy audit lại, không tuyên bố fixed.

Initial export bắt đầu trước khi source-freeze nên Metro file map chưa thấy file foreground-clock vừa tạo; lần đó fail resolve. Không sửa assertion/exclude để né. Đã chạy lại --clear sau source-freeze, final export.txt là bằng chứng quyết định; export-initial.txt giữ provenance. Không coi lỗi mid-edit này là kết quả final pass.

Coverage giữ: A0/A restore/deep links/owner/API/epoch; B claim/QR expiry/cardreader; C mutation preflight/slot/quota/operationjournal/recovery; D POS lifecycle/fulfillment/sale/idempotency/sessionclose/statement; E0 decimal/null/currency/noFolio; F Today/exact stop/notification schema/navigation/model metadata; G healthy idle/reconnect, width/fontScale, contrast, clock lifecycle.

Không test RealAPI, QR/NFC hardware, rendered/SR/native lifecycle, large dataset memory/FPS. Typecheck/lint/unit/export không đóng các gate này. Git diff --check bao gồm working tree cũ; BE status vẫn ?? qa/; Web không có diff do G. Không commit/push.
''')
write('SKILL_USAGE',LIMIT+'''Đã đọc lại7 SKILL.md bắt buộc, frontend-testing-debugging và các reference áp dụng. Không chỉ liệt kê tên.

| Skill (installed path) | Áp dụng thực tế | Evidence |
|---|---|---|
| C:/Users/quanh/.codex/skills/expo-native-ui/SKILL.md | Native labels/touch/keyboard/safe area/one list owner; giữ incumbent primitives | Sheet/Loading/Choice/FlatList; G-02…08 |
| …/expo-data-fetching/SKILL.md | Four states, pending khác loading, GET authoritative/SSE cancellation/retry | G-01/G-08; tests |
| …/expo-router/SKILL.md | Inventory route/layout/deep-link/backBehavior; không rewrite hierarchy | SCREEN_INVENTORY, existing navigation tests |
| …/expo-design-system/SKILL.md | Adopt existing ocevie.ts; semantic controlBorder/widths/reuse | DESIGN_SYSTEM; no new Button/Modal |
| …/impeccable/SKILL.md | Chạy impeccable.cmd context --target CASMS_MobileApp/src/components/passenger/PassengerScaffold.tsx thành công; đọc native audit/adapt, ios/android, harden, craft-floor, polish | Source audit→triage→fix→regression; rendered blocked, không claim detector/native QA |
| C:/Users/quanh/OneDrive/Máy tính/CASMS_Frontend/.agents/skills/ui-ux-pro-max/SKILL.md | Search touch target text scaling --stack react-native (3 matches); focus not obscured --domain ux (Web-specific, chỉ tham khảo nguyên tắc, không native ARIA); đọc pro-rules/quick-reference | Touch48, visible labels, width/fontScale; output native version0.86 guidance không lấn SDK58/RN0.88 docs |
| …/frontend-design/SKILL.md | Intentional hierarchy/OceVie identity; Operating context cho POS, đọc chuyến trước action Passenger | Không thêm decorative hero/card system/palette/font |
| …/frontend-testing-debugging/SKILL.md | Browser availability classification; fixture preview/runtime attempt; report exact blocked/not-run | RENDERED_UI_QA; no fake screenshot |

Context launcher không tìm PRODUCT.md/DESIGN.md ở root; task là scoped refinement nên đọc authority thực tế design-systems/ocevie và Mobile docs/tokens. Hook drift báo theo skill, không repair hook/doctor ngoài phạm vi. Native audit reference nói không chạy Web detector cho React Native; không bịa impeccable subcommand hoặc score rendered.

Catalogue cài thực tế chỉ4 Expo skill đã nêu, không có expo-ui/performance/accessibility/mobile-testing riêng; react-best-practices/frontend-app-builder/browser cũng không có. Không cài thêm hoặc áp animate-ui Web vào native. Computer-use SKILL.md được đọc khi kiểm tra khả năng fallback; không thao tác Windows app hoặc tải helper. CUA chỉ thử IAB tab, không kiểm native bằng Browser.

Đã đọc AGENTS gốc/Mobile, Mobile UX/token/shared components, báo cáo final0/A0/A/B/C/D/E0/F và handoff/backlog; contract quyết định vẫn đối chiếu source. Tài liệu chính thức đúng SDK58: [SDK reference](https://docs.expo.dev/versions/v58.0.0/), [expo/fetch streaming](https://docs.expo.dev/versions/v58.0.0/sdk/expo/), [Expo documentation index](https://docs.expo.dev/llms.txt). expo/fetch đã có sẵn, không cài package.
''')
write('FINAL_SUMMARY',LIMIT+'''**UI_UX_SOURCE_READY_RUNTIME_QA_BLOCKED**.

G0: đã xác định SDK/ADB/AVD/Go có; boot được Android16 x86_64, nhưng preview local/browser attachment chưa đưa tới product UI; chưa dev build NFC. Có runtime logs/runbook/bàn giao M, không visual QA pass.

G1: audit mọi Passenger route/subscreen; thực thi shared control contrast/labels/disabled choice, sheet keyboard/a11y, Home facts/time width, paused vs loading/empty, notification FlatList. Navigation5tab/Today/timezone/exact BP/voyage/claim/journals giữ.

G2: audit đầy đủ POS; Dashboard và Requests adaptive panes dựa width/fontScale, forms bounded; pause foreground display clocks; sửa SSE healthy idle bằng handshake45s + verified lease30min/stable retry budget. Source/tests đạt, tablet/native accessibility/performance acceptance chưa đạt vì thiếu runtime evidence.

Bộ cuối198/198 unit/contract, SSE subset13/13; typecheck/lint/export và exit status cuối ở FE_REGRESSION/evidence/verification.json. Doctor19/20 và11 mismatch nền giữ; không package upgrade/advisory fix. Không BE/DB/Web/financial/POS business change, commit/push. Đủ15 báo cáo tiếng Việt, inventory và finding before/after trong FE_IMPLEMENTATION.

M06/M07 Folio, M08 activation, M09 QA, M13 config/runtime, M15 model benchmark, M17 assignment và BE-08…24 giữ OPEN; ACK/published change history/push/support API chặn riêng. DB-04/06 QA datasets chưa xác nhận. Không có finding được đóng chỉ vì source UI tốt hơn.

**Có đủ hồ sơ chuyển sang Phase M-FE để xử lý toolchain/native build/connectivity và thực hiện device/rendered/performance QA khi được giao. Chưa đủ điều kiện nghiệm thu toàn bộ Mobile hoặc chuyển thẳng sang kết luận H E2E pass.** Không triển khai M/H trong G. Danh sách file/hash và finding chi tiết ở FE_IMPLEMENTATION; runtime/testing limitations ở RUNTIME_READINESS/RENDERED_UI_QA.
''')
print(json.dumps({'reports':15,'route_files':len(routes),'screens_redirects':sum(not r['layout'] for r in routes),'changed_source_test':len(changed)},ensure_ascii=False))
