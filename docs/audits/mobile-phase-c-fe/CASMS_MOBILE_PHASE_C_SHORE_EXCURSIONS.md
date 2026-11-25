# CASMS Mobile Phase C — SHORE_EXCURSIONS

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc: ShoreExcursionController/Service/Response, ActivityService.registerExcursion/confirm/cancel, CruiseStopResponse, ItineraryDayResponse và adapter itinerary. File sửa: PassengerActivitiesScreen, passenger-api/types và schema; không sửa itinerary architecture.

Root cause: adapter cũ chỉ kiểm UUID và dùng find itinerary đầu tiên, mất metadata cảng/ngày; list registrations không lọc context. Sau: mine theo cruise Confirmed/Active, itinerary OPEN_FOR_SALE/ACTIVE; dedup itineraryId và từ chối ambiguous thay vì chọn tùy tiện. Query CruiseStop bằng itinerary ID, giữ đúng stop.itineraryId; loại OMITTED/SUBSTITUTED. Fetch excursion bằng cruiseStopId, drop row khác stop. Attach portName/portTimeZoneId/arrivalItineraryDayId từ đúng stop, không ghép bằng tên hoặc ngày. Không tự invent ngày cảng hoặc bản đồ.

Tour hiển thị start/plannedReturnTime theo port timezone hoặc UTC, meetingPoint, status, price/currency/availableCapacity/maximumCapacity khi có. Không có mô tả tour riêng trong ShoreExcursionResponse nên không dựng copy demo. Trước POST refetch chuỗi itinerary/stops/excursions rồi availability, kiểm cùng tour/stop/return time, sau đó API registration kiểm scope ở Backend. Điểm dừng bị bỏ/thay khiến tour cũ không còn đăng ký trong flow mới.

API create EXCURSION_BOOKING; read list/detail EXCURSION_READ kèm itinerary/stop permissions. Confirm/update/cancel chung ACTIVITY_REGISTRATION. Không mặc định EXCURSION_BOOKING tự có quyền đọc/đối soát registrations; ghi permission/read projection ở BE-16. Fare entitlement đọc từ purchased projection, không suy phí từ tên tour.

Tests exact ID, omitted call, wrong-stop row, itinerary chain, nullable price/capacity, schema và no retry. Không QA route cảng thay đổi trên DB thật. Acceptance: source/contract sẵn sàng, schedule/fixture/permission API thật còn external blocker.
