# Chuyến đi → Tuyến tàu → Chương trình → Kiểm tra

## Baseline / scope
- Base FE: 5e97c6e4fbbbbbb216b28ab228ca9b1c01c85506. Existing activity-api.ts change and all untracked docs are preserved.
- BE has existing .idea, V25, compiler metadata changes and untracked local files; read only.
- Allowed: src/features/cruises/{pages/CruiseFormPage.tsx,api/cruise-api.ts,api/dto.ts,model/cruise-validation.ts,components/Cruises.module.css}; src/features/itineraries/**; src/shared/lib/journey-time.ts; src/shared/ui/JourneySteps.tsx; src/shared/ui/JourneySteps.module.css; src/shared/ui/index.ts; this contract; tests/journey-time.test.mjs.
- No BE, database, booking, fleet, dependency, global branding, Git branch/pull/push changes. Reuse Admin Shell and Modal drawer. No fabricated saved records.

## Mapping verified against local controllers / DTOs
| UI | Source | Request | Type / required | Conversion | Save API |
|---|---|---|---|---|---|
| Tên chuyến | User | cruiseName | string / yes | trim | POST /cruise; PATCH /cruise/{id}/draft |
| Thời lượng | CruiseCruiseType | cruiseType | ONE_DAY / MULTI_DAYS | explicit mapping 1–2 / 3–5 calendar days | same |
| Khởi hành / kết thúc | User | departureDatetime / returnDatetime | Instant / yes | Vietnam IANA wall time → UTC | same |
| Cảng đi / về | GET /ports/active | departurePortId / returnPortId | UUID / yes | selected IDs | same |
| Phạm vi / miền / quốc gia / giới thiệu | No cruise storage contract | none | unsupported | do not submit or imply persisted | none |
| Lịch trình | Existing cruise | cruiseId, itineraryName?, startDate?, endDate?, itineraryType? | UUID, string, LocalDate, ROUND_TRIP/ONE_WAY | omit blank optionals; explicit Vietnam dates when known | POST /itineraries; PATCH /itineraries/{id}/draft |
| Ngày | same itinerary | itineraryId, dayNumber, date, dayType, shipTimeZoneId, description | UUID, int, LocalDate, PORT_DAY/SEA_DAY, string | fixed Asia/Ho_Chi_Minh; explicit type selection | POST /itinerary-days; PATCH /itinerary-days/{id} |
| Lần ghé cảng | GET /ports/active + saved days | itineraryId, arrivalItineraryDayId, departureItineraryDayId, portId, destinationId?, stopOrder?, plannedArrival, plannedDeparture, callType, arrivalMethod, allAboardTime? | UUIDs, int, Instant, NORMAL/LATE_NIGHT/OVERNIGHT, BERTH/TENDER | port IANA wall time → UTC; show Vietnam time; reject ambiguous/nonexistent times | POST /cruise-stops; PATCH /cruise-stops/{id} |
| Hoạt động | GET /activities envelope | activityName, description, startTime, endTime, location, capacity, price, currencyCode, cruiseId | existing ActivityRequest | select existing ID in same cruise; edit supported fields, Vietnam time → Instant | PUT /activities/{id} |
| Tham quan | GET /shore-excursions raw array | existing cruiseStopId association | UUID + Instant times | compare with current stop and allAboardTime | existing excursion editor; no duplicate assignment API |
| Dịch vụ | GET /servicepackage/services envelope | no plan-window request | unsupported | read-only catalog; never use reservation schedules as plan windows | none |

IDs are server UUIDs. Normal endpoints use ApiResponse; excursions use raw JSON. Existing API client handles auth, envelope errors and 204. PATCH omits unchanged optional associations (BE ignores null); UI must not pretend null clears them. API errors keep forms. Explicit mutation locks; no automatic creation retries.

## Verified gaps and integration choices (before form edits)
1. Cruise draft requires actual departure/return instants + both port IDs. Keep a clearly explained required schedule section instead of inventing values. Unsupported metadata is visibly unavailable.
2. ItineraryService rejects endDate == startDate, defaults dates in UTC but validates with server zone. One-day itinerary blocked; send Vietnam dates explicitly and report server validation failures. BE must allow same-day and consistently use Vietnam calendar.
3. Itinerary create initializes no days. DayType only SEA_DAY/PORT_DAY, null defaults PORT_DAY. Never silently save a chosen type. Offer unsaved initial day positions (1 short / 3 long) and require type when saving; existing IDs remain authoritative.
4. No atomic remove/reindex endpoint. Delete only an unreferenced final day; show impact across overnight stops, timed activities and excursions. Do not cascade or renumber behind user's back.
5. Activity is a scheduled cruise instance, not a reusable master catalog. Picker edits an existing same-cruise instance; a reusable activity template + assignment endpoint is needed for that requested capability.
6. ServiceSchedule is explicitly scheduled reservation inventory (requiresSchedule, capacity), not opening/service-plan windows. Plan-window persistence and day associations are needed. Show unavailable with explanation; no schedule writes here.
7. Publish sets itinerary OPEN_FOR_SALE, does not publish Cruise or booking. Label as publishing itinerary, explain existing status; no fake version lock.
8. Fixed ship time zone is sent on day writes. Old different zones are flagged until explicitly saved; no automatic migration.

## Acceptance and verification
Shared day/stop source for route/program; stable keys; drawer focus/escape/dirty protection; no duplicate create on navigation; port overnight and repeated calls allowed; zone missing blocks save; review links to relevant day/stop; permissions stay enforced server-side.
User follow-up explicitly requests coding without tests. Run only lint/typecheck/build; no automated, browser or live tests and no business data writes. No backend startup/migration or fixture success presented as live integration.

## Triển khai FE đã thực hiện
- Form chuyến đi một cột, tên + nhóm thời lượng; Lưu nháp / Tiếp tục lập lịch trình. Giữ lịch thực tế và cảng bắt buộc, giải thích xung đột hợp đồng ngay trong form. Không gửi cruiseCode.
- Thanh bốn bước dùng Admin Shell hiện tại. Tuyến tàu/Chương trình cùng useItineraryEditor, cùng ID ngày và lần ghé cảng. Các vị trí ngày ban đầu chưa lưu được ghi rõ, không giả làm dữ liệu BE.
- Thêm ngày ở cả hai bước; chọn loại trước khi lưu; cố định shipTimeZoneId. Không tự cắt hoặc xóa ngày khi thay nhóm thời lượng.
- Drawer cảng dùng IANA của cảng, ngày giờ địa phương, đối chiếu Việt Nam; tự chọn ID ngày đến/rời theo ngày Việt Nam. Cho phép cảng lặp lại ở các thời điểm khác nhau và ghé qua đêm. Chặn thiếu múi giờ, thời điểm DST không tồn tại/trùng, đảo giờ, vượt thời gian chuyến, chồng thứ tự và xung đột tham quan.
- Giữ lịch tham quan và hoạt động đọc từ API, chỉnh ngày/giờ/địa điểm bằng PUT /activities/{id} và PUT /shore-excursions/{id}, whitelist body theo request thực. Không tạo danh mục tự do trong editor. Khung phục vụ chỉ tra cứu dịch vụ và thông báo chưa có lưu kế hoạch.
- Kiểm tra có liên kết trở lại ngày/cảng; xóa hiển thị tác động cảng qua ngày, hoạt động, tham quan. Chỉ xóa ngày cuối chưa có tham chiếu, không tự cascade/reindex. Luồng phê duyệt/phát hành dùng endpoint cũ; không mở bán Cruise/booking.
- Ngăn click lặp; kiểm tra lịch trình/ngày/lần ghé đã có trước tạo; giữ form khi lỗi; nếu đã lưu nhưng tải lại lỗi thì đóng form tạo và khóa chỉnh sửa cho đến khi tải lại, tránh gửi lại thao tác đã xác nhận.
- Đọc thêm cấu hình các cảng đã lưu nhưng không còn trong danh sách active. Giữ thao tác vận hành cảng cho lịch trình đã qua giai đoạn nháp, chuyển các ô giờ sang IANA của cảng.

## Đề xuất BE tiếp theo — chưa triển khai và FE không gửi các trường này
1. Mở rộng Cruise create/update/response với description, geographicScope, regionCodes, countryCodes; cung cấp danh mục enum/miền/quốc gia. Cho phép draft thiếu mốc thời gian/cảng, nhưng kiểm tra đầy đủ khi hoàn thiện. Tên field trên là đề xuất, không phải hợp đồng hiện tại.
2. Cho phép Itinerary startDate == endDate; dùng Asia/Ho_Chi_Minh thống nhất để suy ra/kiểm tra LocalDate (hiện create dùng UTC, feasibility dùng systemDefault). API khởi tạo ngày nguyên tử theo nhóm 1/3 ngày; hỗ trợ loại chưa xác định, chưa đủ cảng nhưng lưu nháp được.
3. API tác động xóa ngày gồm cảng qua ngày, hoạt động, tham quan, khung phục vụ; thao tác nguyên tử xóa/reindex có kiểm soát tham chiếu và version. FE hiện chỉ xử lý trường hợp an toàn là ngày cuối chưa dùng.
4. Tách ActivityTemplate và lịch hoạt động của chuyến nếu muốn chọn từ thư viện chung và gắn vào nhiều ngày. Hiện hoạt động API là một sự kiện của một chuyến; FE cập nhật sự kiện đã chọn, không nhân bản hoặc đổi cruiseId.
5. Thêm ServicePlanWindow liên kết lịch trình/ngày/dịch vụ, Instant startsAt/endsAt, quy tắc áp dụng nhiều ngày nguyên tử. Giữ ServiceSchedule/suất đặt/sức chứa độc lập.
6. Kiểm tra IANA bắt buộc của cảng, ghé qua đêm, allAboardTime, tham quan bị ảnh hưởng trong cùng giao dịch cập nhật cảng; bổ sung optimistic version + idempotency cho create. FE guards không thay thế kiểm soát đồng thời BE.
7. Nếu cần phát hành/khóa phiên bản độc lập, bổ sung version/publishedAt/lock và quyền tương ứng. Endpoint publish hiện chỉ chuyển Itinerary sang OPEN_FOR_SALE, không mở bán booking.

## Giới hạn nghiệm thu
- Theo yêu cầu bổ sung của người dùng: không thêm/chạy test, không browser QA, không gọi API ghi dữ liệu demo; không bật lại Docker/BE.
- Chưa xác nhận luồng lưu trên BE đang chạy hoặc giao diện thực tế ở viewport. Các tích hợp được đối chiếu controller/DTO/service trong working tree.
- Không có ảnh tham chiếu trong lượt yêu cầu này; dùng bố cục mô tả và component hiện có.
- Không sửa BE/database/booking/quản lý tàu; không pull/checkout/commit/push.

## Kết quả kiểm tra mã nguồn cuối
- npm run lint: PASS.
- npm run typecheck: PASS.
- npm run build: PASS (Vite production bundle).
- git diff --check: PASS (chỉ có cảnh báo chuẩn hóa LF/CRLF của Git).
- Không chạy test theo yêu cầu. Chưa xác nhận runtime/API lưu hoặc viewport.
- Đối chiếu trạng thái BE cuối task trùng baseline; không có thay đổi BE do task này.
