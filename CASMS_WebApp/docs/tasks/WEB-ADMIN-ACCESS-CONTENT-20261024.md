# Admin Shell authorization and terminology

## Baseline and scope
- FE base 5e97c6e4fbbbbbb216b28ab228ca9b1c01c85506. All journey-editor changes, activity-api.ts and untracked files predate this task; preserve them while applying scoped fixes.
- Sources: user attached Admin Shell permission supplement and explicit terminology decisions (2026-10-24); local BE controller annotations, /auth/me effectivePermissions, Role enum; docs/engineering and docs/design/OCEVIE-admin-workspaces.md. Old product glossary is marked unconfirmed; it cannot override current explicit user decisions.
- Allowed: src/shared/auth/**, src/shared/api/**, src/shared/ui/admin-v3/**, src/features/auth/**, src/app/{layouts/AdminAccountLayout.tsx,pages/AdminOverviewPage.tsx,pages/AdminStaffFunctionPage.tsx,router.tsx}; affected admin feature UI/hooks/API read orchestrators under src/features/{cruises,itineraries,activities,service-packages,shore-excursions,tour-groups,suppliers,regulations,operational-issues,booking,ship-deck-cabin}; docs/product/ocvviet-terminology.md; this report. No business payload/enum/route renaming, backend, database, fleet business logic, booking business logic, dependencies or AI feature.
- Preserve prior no-test instruction: lint/typecheck/build only; no fixtures or live data writes. Report untested runtime scenarios, never claim security QA passed.

## Verified causes before changes
- Login and /admin destination use role homes and a historical role-permission snapshot, rather than waiting for current effectivePermissions.
- Shell unconditionally displays a role-home shortcut while permissions are loading/failed, and lacks a permission retry control.
- Guard keeps an admitted Outlet mounted during permission loading; refresh can retain data/request effects whose authorization is not currently known.
- Permission reset happens in a React effect after auth updates; API client ignores late 401 tokens but does not reject old-session success responses globally.
- Cruise getDetail calls readiness/capacity/issues/effective-regulations without checking their separate endpoint grants. Itinerary editor has similar supplementary-read issues.
- Some contextual links and create actions (e.g. itinerary list) are not gated despite page read access being separate from create authority.

## Verified terminology before UI edits
See docs/product/ocvviet-terminology.md. Only verified terms are used for contextual UI edits. Route names, IDs, enum values and request fields stay exact.

## Integration policy
- Scope extension: shared/ui/PermissionLink.tsx, shared/ui/JourneySteps.tsx, shared/ui/AdminUI.tsx and shared/ui/index.ts apply the same route resolver to contextual links and action links; no CSS hiding. Admin feature imports use this shared link to avoid clickable shortcuts into forbidden modules.
- /auth/me.effectivePermissions is the runtime authority; roles select presentation/order and staff admission only. No ADMIN permission bypass.
- Explicit ANY/ALL requirements; unknown protected admin routes deny. Menu, route and landing use the same resolver, with read dependencies for forms that load an existing record.
- Public BE read endpoints remain public in API transport; existing staff-tool read grants remain the admin UI policy and are documented separately from permitAll annotations.
- A controller-derived API permission manifest prevents disallowed protected network calls. It does not replace BE authorization, ownership/status rules, or component gates.
- Clear effective permissions synchronously when token/session changes; cancel outstanding old-token calls and reject late responses. Permission refresh unmounts protected content until verified; user-keyed route subtree clears per-account UI state.

## Verification and handoff
Record actual commands/results and affected routes/labels below. No test execution is authorized by the prior explicit user preference.

## Tiếp tục ngày 2026-10-25
- Working tree giữ toàn bộ thay đổi của editor chuyến đi và đợt phân quyền đang dang dở; không checkout/pull/revert.
- Đã đọc lại tài liệu `C:/Users/USER/Downloads/Phân tích về context.docx`: mô tả tổ chức lịch trình theo ngày, cảng dừng, hoạt động và tham quan. Tài liệu mô tả chuyến đa ngày, trong khi prompt mới chốt cả nhóm 1–2 ngày; áp dụng quyết định mới cho UI, ghi rõ giới hạn BE lịch trình một ngày trong báo cáo editor trước đó.
- Phát hiện thêm: canSignIn trước đây chỉ chấp nhận 6 role staff dù Role enum và cơ chế xác thực BE hỗ trợ các role staff khác. Dùng nhận diện staff hiện có, không tạo role/grant mới; quyền chức năng vẫn phải lấy từ /auth/me.

## Bảng đối chiếu chức năng, route và quyền

ANY = một trong các quyền liệt kê. ALL = đồng thời các yêu cầu. Mỗi thao tác sửa còn kiểm tra trạng thái/chủ sở hữu/phân công theo màn hình và BE; bảng không tự cấp quyền từ role. Guard trước đây kiểm tra route nhưng có fallback trang đích theo role và giữ trang khi đang tải quyền; nay chỉ mount khi quyền hiện tại đã xác minh.

| Chức năng | Route | Permission BE / khác biệt UI public | Menu | Hành động được phép theo quyền | Guard hiện tại và phần đã sửa |
|---|---|---|---|---|---|
| Tài khoản | /admin/system | /identity/users: ANY USER_READ, OPERATIONAL_ISSUE_ASSIGN, OPERATIONAL_ISSUE_CREATE, OPERATIONAL_ISSUE_UPDATE; trang hệ thống giữ USER_READ | USER_READ | Tra cứu; không tự cấp quyền quản trị khác | Bỏ điều kiện role ADMIN riêng; chỉ dùng quyền hiện tại |
| Đặt chỗ | /admin/bookings | BOOKING_READ | BOOKING_READ | BOOKING_CREATE; sửa BOOKING_UPDATE; xác nhận BOOKING_CONFIRM; hủy BOOKING_CANCEL | Link dùng resolver chung; không sửa nghiệp vụ booking |
| Điểm đến | /admin/destinations | Endpoint read public; admin giữ DESTINATION_READ | DESTINATION_READ | DESTINATION_CREATE / UPDATE / DELETE_UNUSED và quyền trạng thái tương ứng | Tạo/sửa qua route requirement; sửa = read AND mutation |
| Cảng | /admin/ports | Read public; admin giữ PORT_READ | PORT_READ | PORT_CREATE / UPDATE / ACTIVATE / DEACTIVATE / DELETE_UNUSED | Giữ trạng thái/nghiệp vụ; lọc shortcut |
| Tàu | /admin/ships | Read public; admin giữ SHIP_READ | SHIP_READ | SHIP_CREATE / UPDATE / DELETE / STATUS_CHANGE | Link tham chiếu dùng guard chung; không sửa mô hình tàu |
| Boong | /admin/decks | DECK_READ ở admin; xem nguồn endpoint trong manifest | DECK_READ | DECK_CREATE / UPDATE / DELETE | Read AND update khi vào editor |
| Cabin | /admin/cabins | CABIN_READ ở admin; xem nguồn endpoint trong manifest | CABIN_READ | CABIN_CREATE / UPDATE / DELETE và quyền vận hành tương ứng | Không suy quyền từ tên vai trò; không sửa tồn/phân bổ |
| Chuyến đi | /admin/cruises | Read public; admin giữ CRUISE_READ | CRUISE_READ | CREATE / UPDATE_DRAFT / ASSIGN_SHIP / CHANGE_SHIP / UNASSIGN_SHIP / PUBLISH / START / COMPLETE / CANCEL / DELETE_DRAFT với tiền tố CRUISE_ | Readiness/capacity chỉ gọi với CRUISE_VALIDATE; issues/regulations chỉ gọi khi có quyền riêng |
| Lịch trình | /admin/itineraries | Read public; admin giữ ITINERARY_READ | ITINERARY_READ | ITINERARY_CREATE / UPDATE_DRAFT / SUBMIT / APPROVE / REJECT / PUBLISH / CANCEL | Ngày, cảng và danh mục phụ thuộc được kiểm tra riêng; giữ enum nguyên gốc |
| Nhật ký lịch trình | /admin/itinerary-history | ITINERARY_CHANGE_READ | Link đọc cùng quyền | ITINERARY_CHANGE_RECORD để ghi | Không suy quyền ghi từ đọc |
| Quy định | /admin/regulations | REGULATION_READ | REGULATION_READ | REGULATION_CREATE / UPDATE / ACTIVATE / DEACTIVATE / DELETE / VALIDATE | Shortcut chung; không đổi body gán quy định |
| Quy định theo tàu/chuyến | /admin/ships/:id/regulations; /admin/cruises/:id/regulations | SHIP_REGULATION_READ / CRUISE_REGULATION_READ | Link yêu cầu quyền tương ứng | *_REGULATION_ASSIGN / REMOVE | Không dùng REGULATION_READ thay quyền quan hệ |
| Sự cố | /admin/issues | OPERATIONAL_ISSUE_READ | Cùng quyền đọc | CREATE / UPDATE / ASSIGN / RESOLVE / ESCALATE với tiền tố OPERATIONAL_ISSUE_ | Giữ lifecycle/assignment hiện có; lọc link |
| Nhà cung cấp | /admin/suppliers | SUPPLIER_READ | Cùng quyền đọc | SUPPLIER_CREATE / UPDATE / VERIFY / STATUS_CHANGE / DELETE | Guard đọc/sửa riêng |
| Tham quan trên bờ | /admin/shore-excursions | EXCURSION_READ | Cùng quyền đọc | EXCURSION_CREATE / UPDATE / STATUS_CHANGE / DELETE_DRAFT / VALIDATE | Guard và link chung; không đổi supplier/cruiseStopId |
| Nhóm tour | /admin/tour-groups | TOUR_GROUP_READ | Cùng quyền đọc | TOUR_GROUP_CREATE / UPDATE / GUIDE_ASSIGN / STATUS_CHANGE; passenger quyền riêng | Giữ ràng buộc hành khách và trạng thái |
| Hoạt động trên tàu | /admin/activities | ACTIVITY_READ | Cùng quyền đọc | ACTIVITY_CREATE / UPDATE / LIFECYCLE | RegistrationPanel chỉ mount với ANY ACTIVITY_ATTENDANCE / ACTIVITY_REGISTRATION |
| Đăng ký hoạt động | /admin/activity-registrations | ANY ACTIVITY_ATTENDANCE / ACTIVITY_REGISTRATION | Shortcut cùng guard | Đăng ký/điểm danh theo quyền endpoint thực | Không dùng EXCURSION_READ thay quyền đọc đăng ký |
| Dịch vụ | /admin/services | SERVICE_READ | Cùng quyền đọc | SERVICE_CREATE / UPDATE / ACTIVATE / SUSPEND / DELETE_UNUSED | Không gộp lịch đặt với khung phục vụ |
| Sản phẩm | /admin/products | PRODUCT_MANAGE | PRODUCT_MANAGE | CRUD qua cùng quyền BE | Không phát minh PRODUCT_READ |
| Gói dịch vụ | /admin/service-packages | List/detail/benefits public; admin giữ ANY TOUR_PACKAGE_MANAGE / TOUR_PACKAGE_ASSIGN / BOOKING_READ | Cùng điều kiện admin | TOUR_PACKAGE_MANAGE CRUD; PACKAGE_COMPONENT_MANAGE thay thành phần | Editor thành phần chỉ mount khi có ANY TOUR_PACKAGE_MANAGE / PACKAGE_COMPONENT_MANAGE; nguồn picker kiểm tra quyền riêng |
| Yêu cầu dịch vụ | /admin/service-requests | ANY SERVICE_REQUEST_READ / SERVICE_REQUEST_CREATE | Cùng điều kiện | Edit ANY CREATE / EXECUTE; workflow ANY ASSIGN / EXECUTE; cancel CREATE | Read AND mutation cho editor; vẫn kiểm tra phân công/status |
| Phân bổ gói | /admin/package-assignments | ANY TOUR_PACKAGE_ASSIGN / TOUR_PACKAGE_MANAGE / BOOKING_READ | Cùng điều kiện | TOUR_PACKAGE_ASSIGN để đổi phân bổ | Không dùng quyền xem booking để thay gói |
| Làm thủ tục | /admin/staff/checkin | UI ANY CHECKIN_READ / CREATE / UPDATE; endpoint có guard riêng | Cùng điều kiện | CheckinDesk theo quyền hiện có | Trang dữ liệu riêng không tự gọi vì role; request được kiểm tra manifest |
| Tài chính | /admin/staff/finance | PAYMENT_REPORT ở route; BOOKING_READ / PAYMENT_READ / PAYMENT_PROCESS ở API thực | PAYMENT_REPORT | Thu/đọc theo quyền API và điều kiện khoản thu | Không cấp thêm BOOKING_READ từ PAYMENT_REPORT; thiếu quyền API trả thông báo quyền |

Nguồn chi tiết từng method/path/permission và dòng controller: `src/shared/auth/api-permissions.json` (329 khai báo: 305 có authority, 24 permitAll). Các endpoint không có @PreAuthorize như auth/me không bị suy diễn permission. Manifest là snapshot của working tree BE, phải cập nhật nếu hợp đồng BE thay đổi; không phải cơ chế bảo mật thay BE.

## Bảng nội dung đã đổi theo ngữ cảnh

| Vị trí UI | Nội dung cũ | Nội dung mới | Lý do sửa | Nguồn nghiệp vụ | Điểm cần xác nhận |
|---|---|---|---|---|---|
| Sidebar chuyến | Chuyến du lịch | Chuyến đi | Tách khỏi lịch trình | Prompt, Cruise DTO | Không |
| Sidebar lịch trình | Hải trình | Lịch trình | Nội dung theo ngày thuộc chuyến | Prompt, Itinerary DTO | Không |
| Mô tả workspace lịch | Chuyến đi · Hải trình · Cảng ghé | Chuyến đi · Lịch trình · Lần ghé cảng | Phân biệt bản ghi cảng và một lần xuất hiện | Prompt, CruiseStop DTO | Không |
| Shortcut tạo | Tạo chuyến du thuyền | Tạo chuyến đi | Một tên nhất quán | Prompt | Không |
| Danh sách chuyến | Chuyến du thuyền | Chuyến đi | Thống nhất với sidebar/form | Prompt | Không |
| Breadcrumb/chi tiết chuyến | CRUISE; Chỉnh sửa cruise | CHUYẾN ĐI; Chỉnh sửa chuyến đi | Bỏ tên entity kỹ thuật khỏi nhãn | Prompt, CruiseController | Không |
| Thông tin chuyến | Loại chuyến | Thời lượng chuyến | ONE_DAY/MULTI_DAYS không phải phạm vi quốc gia | Prompt, enum, form hiện tại | Không |
| Nội dung liên kết lịch | quản lý tại hải trình | quản lý trong lịch trình của chuyến đi | Không gợi ý thư viện độc lập | Prompt | Không |
| Nút công bố chuyến | Phát hành cruise | Công bố chuyến đi | Tách với phát hành lịch trình | CruiseService.publish, ngôn ngữ công bố hiện có | Không |
| Nút kết thúc/hủy | Hoàn thành cruise; Hủy cruise | Kết thúc chuyến đi; Hủy chuyến đi | Mô tả đối tượng thực của hành động | Cruise lifecycle | Không |
| Xác nhận hành động chuyến | thao tác PUBLISH/START/... | Công bố chuyến đi/Bắt đầu vận hành/... | Nêu hành động; không đưa enum vào lời xác nhận | Method API tương ứng | Không |
| Trạng thái lịch trình trên chi tiết chuyến | OPEN_FOR_SALE hoặc Mở bán | Đã phát hành | Không khẳng định booking đã mở bán | Prompt, ItineraryService.publish | Không |
| Cảnh báo readiness | Hải trình đã mở bán; trạng thái enum kỹ thuật | Lịch trình đã phát hành; kết quả sẵn sàng chưa chấp nhận trạng thái này | Nêu đúng mâu thuẫn và ảnh hưởng | Prompt, readiness service | BE cần đồng bộ điều kiện readiness |
| Trang nhật ký | Nhật ký thay đổi hải trình; Danh sách hải trình | Nhật ký thay đổi lịch trình; Danh sách lịch trình | Thống nhất đối tượng | Prompt, history DTO | Không |
| Vận hành lần ghé | Bỏ điểm dừng; Thay bằng điểm dừng khác | Bỏ lần ghé cảng; Thay bằng lần ghé cảng khác | CruiseStop không phải Port hay điểm tham quan | Prompt, CruiseStop methods | Không |
| Liên kết từ hoạt động | Xem chuyến du lịch | Xem chuyến đi | Thống nhất danh từ | Prompt, activity.cruiseId | Không |
| Shell chưa có chức năng | Shortcut trang chủ theo role | Tài khoản chưa được cấp quyền truy cập chức năng | Không dẫn đến route bị cấm hoặc redirect lặp | Effective permissions | Không |

Các nhãn chưa có căn cứ để đổi giữ nguyên. OcvViet trong prompt và OceVie trong asset hiện có được ghi là cần xác nhận; không tự đổi thương hiệu. Không có chức năng AI mới, nội dung AI tự động lưu, seed hay trạng thái mới được tạo.

| Vị trí UI bổ sung | Nội dung cũ | Nội dung mới | Lý do sửa | Nguồn nghiệp vụ | Điểm cần xác nhận |
|---|---|---|---|---|---|
| Lịch đặt dịch vụ | Lịch cung cấp dịch vụ | Lịch đặt dịch vụ; giải thích đây là khung giờ nhận đặt chỗ có sức chứa | Không gọi nhầm thành khung phục vụ nhà hàng/spa | ServiceScheduleManagementService, prompt | Khung phục vụ kế hoạch vẫn cần BE |
| Giờ buổi hướng dẫn và lịch đặt dịch vụ | Bắt đầu (giờ máy) | Bắt đầu (giờ Việt Nam) | Giờ trên tàu cố định theo quyết định đã chốt; cả parse/serialize/display cùng IANA Việt Nam | Prompt, Instant request fields | Không |

## Phạm vi kết quả và điểm cần xác nhận
- Menu, direct route, trang đích, ButtonLink và liên kết tham chiếu dùng cùng resolver permission. Các import PermissionLink trong module tàu/cabin chỉ thay cách cấp link, không sửa nghiệp vụ đội tàu.
- /auth/me phải trả đúng userId; loading/error/anonymous không cấp quyền. Guard ngừng mount nội dung trong lúc kiểm tra, kể cả refresh. Logout xóa quyền ngay; subtree theo userId cùng cơ chế hủy/loại response cũ ngăn dùng trạng thái phiên trước.
- API transport giữ nguyên method/path/query/body và envelope, chỉ bổ sung kiểm tra quyền/phiên. Các điều chỉnh múi giờ vẫn gửi Instant cùng tên field, không gửi enum/nhãn Việt thay dữ liệu kỹ thuật.
- Role vẫn có thể nhìn thấy module tham chiếu nếu BE cấp quyền đọc module đó. Nếu dự án muốn thu hẹp hơn quyền đang cấp trong BE, cần xác nhận/chỉnh chính sách BE riêng; FE không tự xóa grant theo tên role.
- Một số endpoint read permitAll trong BE nhưng công cụ quản trị vẫn có quyền menu theo chính sách FE hiện hữu. Bảng trên ghi rõ khác biệt; không nói những endpoint đó được BE bảo vệ bởi READ permission.
- Historical backendRolePermissions export được giữ để không phá các tham chiếu cũ, nhưng không còn được dùng để chọn trang đích, menu, route hoặc gửi request. Quyền runtime luôn từ /auth/me.
- Chưa có nguồn để chốt đổi tên thương hiệu asset OceVie thành OcvViet; giữ nguyên branding hiện tại. Không tự xác lập thêm ý nghĩa của bến/điểm neo/điểm tham quan.
- Không chạy test theo yêu cầu trước đó; chưa nghiệm thu runtime các bộ quyền/tài khoản, reload, 401/403 hay viewport. Kiểm tra tĩnh và build không thay thế các ca này.
- Không sửa BE/database, không bật Docker, không seed dữ liệu, không commit/push.

## Kết quả kiểm tra cuối — 2026-10-25
- `npm run lint`: PASS. Đã sửa 4 cảnh báo lỗi khởi tạo biến thừa do bước chuyển đổi giờ mới trước khi chạy lại.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, 388 modules, Vite production bundle.
- `git diff --check`: PASS; Git chỉ thông báo chuẩn hóa LF/CRLF ở file đã có thay đổi trước đó.
- Trạng thái working tree BE giữ nguyên các thay đổi có sẵn (.idea, V25, compiler metadata, V24/openapi/start-local); task không sửa BE.
- Không chạy test, không kiểm tra runtime/API bằng tài khoản và không ghi dữ liệu. Chưa tuyên bố các ca 401/403, chuyển tài khoản hoặc toàn bộ trạng thái màn hình đã được nghiệm thu trực tiếp.
